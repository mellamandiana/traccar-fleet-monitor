import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEVICES_POLL_MS, POSITION_POLL_MS } from '../config.js';
import { ErrorKind } from '../api/errors.js';
import { usePolling } from '../hooks/usePolling.js';
import { useFleetEvents } from '../hooks/useFleetEvents.js';
import Header from './Header.jsx';
import DeviceList from './DeviceList.jsx';
import StatusCard from './StatusCard.jsx';
import VehicleMap from './VehicleMap.jsx';
import ErrorState from './ErrorState.jsx';
import EmptyState from './EmptyState.jsx';

// Parámetro de prueba `?romper=1`: el monitor lanza una excepción al pintarse para
// demostrar la pantalla del ErrorBoundary. Sigue fallando (React reintenta el render
// una vez por su cuenta) hasta que el operador pulsa "Volver a cargar la vista".
let crashPending = (() => {
  try {
    return new URLSearchParams(location.search).get('romper') === '1';
  } catch {
    return false;
  }
})();

export function disarmSimulatedCrash() {
  crashPending = false;
}

export default function Monitor({ client, user, server, simulated, theme, onToggleTheme, onLogout, onUseSimulated }) {
  if (crashPending) throw new Error('Fallo simulado de render (?romper=1)');
  const onAuthError = useCallback(() => onLogout('expired'), [onLogout]);

  // 2. Lista de dispositivos (se refresca para mantener el estado online/offline al día).
  const devices = usePolling((signal) => client.getDevices(signal), {
    interval: DEVICES_POLL_MS,
    key: client,
    onAuthError,
  });

  const [selectedId, setSelectedId] = useState(null);
  const list = devices.data;

  // Selección inicial: el primer vehículo en línea (o el primero de la lista).
  useEffect(() => {
    if (!list?.length) return;
    if (selectedId != null && list.some((d) => d.id === selectedId)) return;
    const first = list.find((d) => d.status === 'online') ?? list[0];
    setSelectedId(first.id);
  }, [list, selectedId]);

  const device = useMemo(() => list?.find((d) => d.id === selectedId) ?? null, [list, selectedId]);

  // Título de la pestaña (WCAG 2.4.2): dice qué se está viendo, también con varias pestañas abiertas.
  useEffect(() => {
    const base = 'Monitor de flota · Traccar';
    if (devices.status === 'error') document.title = `Error de conexión · ${base}`;
    else if (device) document.title = `${device.name} · ${base}`;
    else document.title = `Cargando · ${base}`;
  }, [devices.status, device]);

  // 3. Posición del vehículo seleccionado, por polling.
  const position = usePolling((signal) => client.getLatestPosition(selectedId, signal), {
    interval: POSITION_POLL_MS,
    enabled: selectedId != null,
    key: `${selectedId}`,
    onAuthError,
  });

  // Notificaciones: registro de eventos derivado de los datos que ya consultamos.
  const fleet = useFleetEvents({
    devices: list,
    device,
    position: position.data?.deviceId === selectedId ? position.data : undefined,
    stale: position.isStale,
  });

  // Búsqueda: el botón de la barra y la tecla "/" llevan al buscador de vehículos.
  const focusSearch = useCallback(() => {
    const input = document.getElementById('buscar-vehiculo');
    if (!input) return;
    input.scrollIntoView({ block: 'center', behavior: 'smooth' });
    input.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      e.preventDefault();
      focusSearch();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [focusSearch]);

  const header = (
    <Header
      user={user}
      server={server}
      simulated={simulated}
      theme={theme}
      onToggleTheme={onToggleTheme}
      onLogout={() => onLogout()}
      events={fleet.events}
      unread={fleet.unread}
      onOpenNotifications={fleet.markAllRead}
      onSelectDevice={setSelectedId}
      onSearch={focusSearch}
    />
  );

  // Fallo al cargar la lista: no hay nada que mostrar todavía → pantalla de error completa.
  if (devices.status === 'error') {
    return (
      <div className="app">
        {header}
        <main id="contenido" className="app__fallback">
          <ErrorState
            error={devices.error}
            serverLabel={server?.label}
            onRetry={devices.retry}
            onSwitchServer={() => onLogout()}
            nextAttemptAt={devices.nextAttemptAt}
            retryDelay={devices.retryDelay}
            failures={devices.failures}
            inFlight={devices.inFlight}
          />
        </main>
      </div>
    );
  }

  if (devices.status === 'ready' && list.length === 0) {
    return (
      <div className="app">
        {header}
        <main id="contenido" className="app__fallback">
          <EmptyState
            serverLabel={server?.label}
            onSwitchServer={() => onLogout()}
            onReload={devices.retry}
            onUseSimulated={onUseSimulated}
            checking={devices.inFlight}
            checkedAt={devices.lastSuccessAt}
          />
        </main>
      </div>
    );
  }

  // Justo al cambiar de vehículo, el polling aún guarda la posición del anterior
  // durante un render: nunca mostramos (ni anunciamos) datos de otro vehículo.
  const raw = position.data;
  const belongs = raw === null || raw?.deviceId === selectedId;
  const currentPosition = belongs ? raw : undefined;

  const loadingDevices = devices.status === 'loading';
  const positionLoading = loadingDevices || position.status === 'loading' || (raw !== undefined && !belongs);
  const positionFailed = position.status === 'error';

  return (
    <div className="app">
      {/* Enlaces para saltar: el primer Tab de la página los muestra. */}
      <nav className="skip-links" aria-label="Accesos directos">
        <a className="skip-link" href="#tarjeta-vehiculo">
          Saltar a la tarjeta del vehículo
        </a>
        <a className="skip-link" href="#lista-vehiculos">
          Saltar a la lista de vehículos
        </a>
      </nav>
      {header}
      <main id="contenido" className="app__layout">
        <StatusCard
          device={device}
          position={currentPosition}
          loading={positionLoading}
          failed={positionFailed}
          error={position.error}
          stale={position.isStale}
          nextAttemptAt={position.nextAttemptAt}
        />

        <VehicleMap
          device={device}
          position={currentPosition}
          loading={positionLoading}
          failed={positionFailed}
          error={position.error}
          stale={position.isStale}
          nextAttemptAt={position.nextAttemptAt}
          retryDelay={position.retryDelay}
          failures={position.failures}
          inFlight={position.inFlight}
          onRetry={position.retry}
          theme={theme}
          pollInterval={POSITION_POLL_MS}
        />

        <DeviceList
          devices={list}
          loading={loadingDevices}
          stale={devices.isStale}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </main>
      {position.error?.kind === ErrorKind.NOT_FOUND && <span className="visually-hidden" role="status">El vehículo seleccionado ya no está disponible.</span>}
    </div>
  );
}
