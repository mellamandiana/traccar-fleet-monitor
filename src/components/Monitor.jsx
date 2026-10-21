import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEVICES_POLL_MS, POSITION_POLL_MS } from '../config.js';
import { ErrorKind } from '../api/errors.js';
import { usePolling } from '../hooks/usePolling.js';
import Header from './Header.jsx';
import DeviceList from './DeviceList.jsx';
import StatusCard from './StatusCard.jsx';
import VehicleMap from './VehicleMap.jsx';
import ErrorState from './ErrorState.jsx';
import EmptyState from './EmptyState.jsx';

export default function Monitor({ client, user, server, simulated, theme, onToggleTheme, onLogout }) {
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

  // 3. Posición del vehículo seleccionado, por polling.
  const position = usePolling((signal) => client.getLatestPosition(selectedId, signal), {
    interval: POSITION_POLL_MS,
    enabled: selectedId != null,
    key: `${selectedId}`,
    onAuthError,
  });

  const header = (
    <Header user={user} server={server} simulated={simulated} theme={theme} onToggleTheme={onToggleTheme} onLogout={() => onLogout()} />
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
          <EmptyState serverLabel={server?.label} onSwitchServer={() => onLogout()} onReload={devices.retry} />
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
      <a className="skip-link" href="#tarjeta-vehiculo">
        Saltar a la tarjeta del vehículo
      </a>
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
          onRetry={position.retry}
        />

        <VehicleMap
          device={device}
          position={currentPosition}
          loading={positionLoading}
          failed={positionFailed}
          error={position.error}
          nextAttemptAt={position.nextAttemptAt}
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
