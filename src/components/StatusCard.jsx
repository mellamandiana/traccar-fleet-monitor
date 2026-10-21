import { useEffect, useRef, useState } from 'react';
import { absoluteTime, compass, coords, knotsToKmh, relativeTime, statusMeta } from '../utils/format.js';
import { useNow } from '../hooks/useEnvironment.js';
import { AnimatedNumber, Flash } from './Motion.jsx';
import StatusPill from './StatusPill.jsx';
import { ArrowIcon, RetryIcon } from './Icons.jsx';
import { StatusCardSkeleton } from './Skeletons.jsx';

const SPEED_SCALE_MAX = 120; // km/h: tope visual de la barra de velocidad

/**
 * Anuncios para lectores de pantalla. Solo se anuncia lo que cambia la decisión
 * del operador (cambio de vehículo, de conexión, arranque/parada), no cada
 * lectura de velocidad: un aria-live que habla cada 5 s sería ruido.
 */
function useAnnouncements(device, position) {
  const [message, setMessage] = useState('');
  const prev = useRef({});

  useEffect(() => {
    if (!device) return;
    const kmh = position ? Math.round(knotsToKmh(position.speed)) : null;
    const moving = kmh != null ? kmh > 0 : null;
    const p = prev.current;
    const status = statusMeta(device.status).label.toLowerCase();

    if (p.id !== device.id) {
      if (position !== undefined) {
        setMessage(`Monitoreando ${device.name}. ${statusMeta(device.status).label}${kmh != null ? `, ${kmh} kilómetros por hora` : ''}.`);
        prev.current = { id: device.id, status: device.status, moving };
      }
      return;
    }
    if (p.status !== device.status) {
      setMessage(`${device.name}: ahora ${status}.`);
    } else if (moving != null && p.moving != null && p.moving !== moving) {
      setMessage(moving ? `${device.name} se puso en marcha a ${kmh} kilómetros por hora.` : `${device.name} se detuvo.`);
    }
    prev.current = { id: device.id, status: device.status, moving: moving ?? p.moving };
  }, [device, position]);

  return message;
}

export default function StatusCard({ device, position, loading, failed, stale, nextAttemptAt, onRetry }) {
  const now = useNow(1000);
  const announcement = useAnnouncements(device, loading ? undefined : position);

  // La región aria-live vive fuera de la rama condicional: debe existir antes de
  // que cambie su contenido, si no los lectores de pantalla no la anuncian.
  const live = (
    <div className="visually-hidden" aria-live="polite" aria-atomic="true">
      {announcement}
    </div>
  );

  if (loading || !device) {
    return (
      <>
      {live}
      <section className="card status-card" id="tarjeta-vehiculo" tabIndex={-1} aria-labelledby="card-title" aria-busy="true">
        <h2 id="card-title" className="visually-hidden">
          Cargando datos del vehículo
        </h2>
        <StatusCardSkeleton />
      </section>
      </>
    );
  }

  const kmh = position ? knotsToKmh(position.speed) : null;
  const dir = position ? compass(position.course) : null;
  const fix = position?.fixTime ? new Date(position.fixTime) : device.lastUpdate ? new Date(device.lastUpdate) : null;
  const battery = position?.attributes?.batteryLevel;
  const retryIn = nextAttemptAt ? Math.max(0, Math.ceil((nextAttemptAt - now) / 1000)) : null;
  const noData = failed || position === null;

  return (
    <>
    {live}
    <section className="card status-card" id="tarjeta-vehiculo" tabIndex={-1} aria-labelledby="card-title">
      <header className="status-card__head">
        <div className="status-card__id">
          <h2 id="card-title" className="status-card__name">
            {device.name}
          </h2>
          <p className="status-card__unique">
            <span className="visually-hidden">Identificador: </span>
            {device.uniqueId}
          </p>
        </div>
      </header>

      {stale && (
        <div className="stale-banner" role="status">
          <span>
            Mostrando la última posición conocida.{' '}
            {retryIn > 0 ? `Nuevo intento en ${retryIn} s.` : 'Reintentando…'}
          </span>
          <button type="button" className="button button--small button--ghost" onClick={onRetry}>
            <RetryIcon width={16} height={16} /> Reintentar ahora
          </button>
        </div>
      )}

      <dl className={`readouts ${stale ? 'readouts--stale' : ''}`}>
        <div className="readout readout--status">
          <dt>Conexión</dt>
          <dd>
            <StatusPill status={device.status} />
          </dd>
        </div>

        <div className="readout readout--speed">
          <dt>Velocidad</dt>
          <dd>
            {noData ? (
              <span className="readout__empty">{failed ? 'Sin datos de posición' : 'Aún no reporta posición'}</span>
            ) : (
              <>
                <Flash value={Math.round(kmh)} className="readout__speed">
                  <span className="readout__speed-value">
                    <AnimatedNumber value={kmh} />
                  </span>
                  <abbr className="readout__unit" title="kilómetros por hora">
                    km/h
                  </abbr>
                </Flash>
                <span className="speed-bar" aria-hidden="true">
                  <span className="speed-bar__fill" style={{ transform: `scaleX(${Math.min(1, kmh / SPEED_SCALE_MAX)})` }} />
                </span>
              </>
            )}
          </dd>
        </div>

        <div className="readout">
          <dt>Última actualización</dt>
          <dd>
            {fix ? (
              <Flash value={fix.getTime()}>
                <time dateTime={fix.toISOString()} className="readout__primary">
                  {relativeTime(fix, now)}
                </time>
                <span className="readout__secondary">{absoluteTime(fix)}</span>
              </Flash>
            ) : (
              <span className="readout__empty">Sin registro</span>
            )}
          </dd>
        </div>

        <div className="readout">
          <dt>Rumbo</dt>
          <dd>
            {dir ? (
              <span className="readout__primary readout__heading">
                <ArrowIcon deg={position.course} width={18} height={18} className="heading-arrow" />
                <span>
                  <abbr title={dir.long}>{dir.short}</abbr> · {Math.round(position.course)}°
                </span>
              </span>
            ) : (
              <span className="readout__empty">—</span>
            )}
          </dd>
        </div>

        <div className="readout">
          <dt>Batería</dt>
          <dd>
            {battery != null ? (
              <Flash value={Math.round(battery)}>
                <span className="readout__primary">{Math.round(battery)} %</span>
                <span className={`battery ${battery <= 20 ? 'battery--low' : ''}`} aria-hidden="true">
                  <span className="battery__fill" style={{ transform: `scaleX(${Math.min(100, battery) / 100})` }} />
                </span>
                {battery <= 20 && <span className="readout__warning">Batería baja</span>}
              </Flash>
            ) : (
              <span className="readout__empty">No reportada</span>
            )}
          </dd>
        </div>

        <div className="readout">
          <dt>Coordenadas</dt>
          <dd className="readout__mono">
            {position ? (
              <>
                <span>{coords(position.latitude, position.longitude).lat},</span>
                <span>{coords(position.latitude, position.longitude).lon}</span>
              </>
            ) : (
              <span className="readout__empty">—</span>
            )}
          </dd>
        </div>
      </dl>

    </section>
    </>
  );
}
