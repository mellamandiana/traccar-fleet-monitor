import { useEffect, useRef, useState } from 'react';
import { absoluteTime, compass, coords, knotsToKmh, relativeTime, statusMeta } from '../utils/format.js';
import { useNow } from '../hooks/useEnvironment.js';
import { AnimatedNumber, Flash } from './Motion.jsx';
import StatusPill from './StatusPill.jsx';
import { ArrowIcon, MetricIcon } from './Icons.jsx';
import VehicleIcon, { VEHICLE_LABEL, vehicleKind } from './VehicleIcon.jsx';
import { StatusCardSkeleton } from './Skeletons.jsx';

const SPEED_SCALE_MAX = 120; // km/h: tope visual de la barra de velocidad

/**
 * Anuncios para lectores de pantalla (aria-live="polite").
 *
 * Un aria-live que leyera la velocidad cada 5 s sería ruido constante y taparía
 * cualquier otra cosa que el operador esté escuchando. Por eso solo se anuncia lo
 * que cambia una decisión:
 *   - vehículo seleccionado (resumen inicial)
 *   - cambio de conexión (en línea / desconectado / sin señal)
 *   - arranque y parada
 *   - cambio fuerte de velocidad (≥ 20 km/h, como mucho uno cada 20 s)
 *   - batería que cae a 20 % o menos
 *   - pérdida y recuperación de los datos en vivo
 */
const SPEED_DELTA_KMH = 20;
const SPEED_COOLDOWN_MS = 20000;

function useAnnouncements(device, position, stale) {
  const [message, setMessage] = useState('');
  const prev = useRef({});

  useEffect(() => {
    if (!device) return;
    const kmh = position ? Math.round(knotsToKmh(position.speed)) : null;
    const moving = kmh != null ? kmh > 0 : null;
    const battery = position?.attributes?.batteryLevel;
    const lowBattery = battery != null && battery <= 20;
    const p = prev.current;
    const now = Date.now();
    const say = (text) => setMessage(text);

    if (p.id !== device.id) {
      if (position !== undefined) {
        say(
          `Monitoreando ${device.name}. ${statusMeta(device.status).label}` +
            `${kmh != null ? `, ${kmh} kilómetros por hora` : ', sin posición'}` +
            `${lowBattery ? `. Batería baja: ${Math.round(battery)} %` : ''}.`,
        );
        prev.current = { id: device.id, status: device.status, moving, kmh, kmhAt: now, lowBattery, stale };
      }
      return;
    }

    const next = { ...p, status: device.status, moving: moving ?? p.moving, lowBattery, stale };
    if (p.stale !== stale) {
      say(stale ? `Se perdió la conexión con Traccar. Se muestra la última posición conocida de ${device.name}.` : 'Conexión recuperada. Datos en vivo de nuevo.');
    } else if (p.status !== device.status) {
      say(`${device.name}: ahora ${statusMeta(device.status).label.toLowerCase()}.`);
    } else if (moving != null && p.moving != null && p.moving !== moving) {
      say(moving ? `${device.name} se puso en marcha a ${kmh} kilómetros por hora.` : `${device.name} se detuvo.`);
      next.kmh = kmh;
      next.kmhAt = now;
    } else if (kmh != null && p.kmh != null && Math.abs(kmh - p.kmh) >= SPEED_DELTA_KMH && now - p.kmhAt >= SPEED_COOLDOWN_MS) {
      say(`${device.name} ${kmh > p.kmh ? 'aceleró' : 'redujo la velocidad'} a ${kmh} kilómetros por hora.`);
      next.kmh = kmh;
      next.kmhAt = now;
    } else if (lowBattery && !p.lowBattery) {
      say(`Batería baja en ${device.name}: ${Math.round(battery)} %.`);
    }
    prev.current = next;
  }, [device, position, stale]);

  return message;
}

export default function StatusCard({ device, position, loading, failed, stale, nextAttemptAt }) {
  const now = useNow(1000);
  const announcement = useAnnouncements(device, loading ? undefined : position, !!stale);

  // La región aria-live es el PRIMER hijo de la tarjeta en todos los estados: React
  // reutiliza el mismo nodo al pasar de esqueleto a datos, y los lectores de pantalla
  // solo anuncian cambios en regiones que ya existían.
  const live = (
    <p className="visually-hidden" aria-live="polite" aria-atomic="true">
      {announcement}
    </p>
  );

  if (loading || !device) {
    return (
      <section className="card status-card" id="tarjeta-vehiculo" tabIndex={-1} aria-labelledby="card-title" aria-busy="true">
        {live}
        <h2 id="card-title" className="visually-hidden">
          Cargando datos del vehículo
        </h2>
        <StatusCardSkeleton />
      </section>
    );
  }

  const kind = vehicleKind(device);
  const kmh = position ? knotsToKmh(position.speed) : null;
  const dir = position ? compass(position.course) : null;
  const fix = position?.fixTime ? new Date(position.fixTime) : device.lastUpdate ? new Date(device.lastUpdate) : null;
  const battery = position?.attributes?.batteryLevel;
  const retryIn = nextAttemptAt ? Math.max(0, Math.ceil((nextAttemptAt - now) / 1000)) : null;
  const noData = failed || position === null;

  return (
    <section className="card status-card status-card--ready" id="tarjeta-vehiculo" tabIndex={-1} aria-labelledby="card-title">
      {live}
      <header className="status-card__head">
        <span className="vehicle-badge" aria-hidden="true">
          <VehicleIcon kind={kind} size={26} />
        </span>
        <div className="status-card__id">
          <h2 id="card-title" className="status-card__name">
            {device.name}
          </h2>
          {/* También identificador y conexión son pares etiqueta-valor: <dl> con <dt> ocultos a la vista. */}
          <dl className="status-card__meta">
            <div>
              <dt className="visually-hidden">Tipo</dt>
              <dd className="status-card__type">{VEHICLE_LABEL[kind]}</dd>
            </div>
            <div>
              <dt className="visually-hidden">Identificador</dt>
              <dd className="status-card__unique">{device.uniqueId}</dd>
            </div>
            <div>
              <dt className="visually-hidden">Conexión</dt>
              <dd>
                <StatusPill status={device.status} />
              </dd>
            </div>
          </dl>
        </div>
      </header>

      <dl className={`readouts ${stale ? 'readouts--stale' : ''}`}>
        <div className="readout readout--speed">
          <dt>Velocidad actual</dt>
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

        <div className="readout readout--row readout--update">
          <dt>
            <span className="metric-icon"><MetricIcon name="clock" /></span>
            Actualización
          </dt>
          <dd>
            {fix ? (
              <Flash value={fix.getTime()}>
                <time dateTime={fix.toISOString()} className="readout__primary">
                  {relativeTime(fix, now)}
                </time>
                {/* El aviso de datos detenidos reemplaza la hora en la MISMA línea: cero desplazamiento. */}
                {stale ? (
                  <span className="readout__secondary readout__secondary--warning">
                    Sin actualizar · {retryIn > 0 ? `reintento en ${retryIn} s` : 'reintentando…'}
                  </span>
                ) : (
                  <span className="readout__secondary">{absoluteTime(fix)}</span>
                )}
              </Flash>
            ) : (
              <span className="readout__empty">Sin registro</span>
            )}
          </dd>
        </div>

        <div className="readout readout--row">
          <dt>
            <span className="metric-icon"><MetricIcon name="route" /></span>
            Rumbo
          </dt>
          <dd>
            {dir ? (
              <span className="readout__primary readout__heading">
                <ArrowIcon deg={position.course} width={16} height={16} className="heading-arrow" />
                <span>
                  {Math.round(position.course)}° <abbr title={dir.long}>{dir.short}</abbr>
                </span>
              </span>
            ) : (
              <span className="readout__empty">—</span>
            )}
          </dd>
        </div>

        <div className="readout readout--row">
          <dt>
            <span className="metric-icon"><MetricIcon name="battery" /></span>
            Batería
          </dt>
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

        <div className="readout readout--location">
          <dt>
            <span className="location-icon"><MetricIcon name="pin" size={20} /></span>
            Ubicación actual
          </dt>
          <dd className="readout__mono">
            {position ? (
              <>
                <span>{coords(position.latitude, position.longitude).lat},</span>{' '}
                <span>{coords(position.latitude, position.longitude).lon}</span>
              </>
            ) : (
              <span className="readout__empty">—</span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
