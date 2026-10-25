import { useCallback, useEffect, useRef, useState } from 'react';
import { knotsToKmh } from '../utils/format.js';

const MAX_EVENTS = 30;
const LOW_BATTERY = 20;

/**
 * Registro de eventos de la flota para el panel de notificaciones.
 *
 * Se alimenta de los mismos datos que ya consulta la app (no hay llamadas extra):
 *  - lista de vehículos → cambios de conexión de CUALQUIER vehículo
 *  - posición del seleccionado → arranque/parada y batería baja
 *  - estado del polling → pérdida y recuperación de los datos en vivo
 *
 * Cada evento: { id, at, kind, deviceId, text }. kind ∈ offline | online | unknown |
 * battery | stop | move | link-lost | link-back | info.
 */
export function useFleetEvents({ devices, device, position, stale }) {
  const [events, setEvents] = useState([]);
  const [readUpTo, setReadUpTo] = useState(0);
  const seq = useRef(0);
  const statuses = useRef(null);
  const sel = useRef({});

  const push = useCallback((kind, text, deviceId = null, read = false) => {
    seq.current += 1;
    const ev = { id: seq.current, at: new Date(), kind, text, deviceId };
    setEvents((list) => [ev, ...list].slice(0, MAX_EVENTS));
    if (read) setReadUpTo(seq.current);
  }, []);

  // Conexión de todos los vehículos.
  useEffect(() => {
    if (!devices?.length) return;
    const prev = statuses.current;
    const next = new Map(devices.map((d) => [d.id, d.status]));
    if (!prev) {
      const online = devices.filter((d) => d.status === 'online').length;
      // El resumen inicial entra ya leído: informa, pero no enciende el punto rojo.
      push('info', `Monitoreo iniciado: ${devices.length} vehículos, ${online} en línea.`, null, true);
    } else {
      for (const d of devices) {
        const before = prev.get(d.id);
        if (!before || before === d.status) continue;
        if (d.status === 'offline') push('offline', `${d.name} se desconectó.`, d.id);
        else if (d.status === 'online') push('online', `${d.name} volvió a estar en línea.`, d.id);
        else push('unknown', `${d.name} dejó de reportar posición.`, d.id);
      }
    }
    statuses.current = next;
  }, [devices, push]);

  // Vehículo seleccionado: arranque/parada y batería baja.
  useEffect(() => {
    if (!device || !position) return;
    const s = sel.current;
    const kmh = Math.round(knotsToKmh(position.speed) ?? 0);
    const moving = kmh >= 1;
    const battery = position.attributes?.batteryLevel;
    const low = battery != null && battery <= LOW_BATTERY;

    if (s.id !== device.id) {
      sel.current = { id: device.id, moving, low };
      if (low) push('battery', `Batería baja en ${device.name}: ${Math.round(battery)} %.`, device.id);
      return;
    }
    if (s.moving !== moving) {
      push(
        moving ? 'move' : 'stop',
        moving ? `${device.name} se puso en marcha (${kmh} km/h).` : `${device.name} se detuvo.`,
        device.id,
      );
    }
    if (low && !s.low) push('battery', `Batería baja en ${device.name}: ${Math.round(battery)} %.`, device.id);
    sel.current = { id: device.id, moving, low };
  }, [device, position, push]);

  // Pérdida y recuperación de los datos en vivo.
  const wasStale = useRef(false);
  useEffect(() => {
    if (stale === wasStale.current) return;
    wasStale.current = stale;
    push(stale ? 'link-lost' : 'link-back', stale ? 'Se perdió la conexión con Traccar.' : 'Conexión con Traccar recuperada.');
  }, [stale, push]);

  const unread = events.filter((e) => e.id > readUpTo).length;
  const markAllRead = useCallback(() => setReadUpTo(seq.current), []);

  return { events, unread, readUpTo, markAllRead };
}
