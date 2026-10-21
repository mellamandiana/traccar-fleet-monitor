/** Traccar entrega la velocidad en nudos. 1 nudo = 1,852 km/h. */
export const KNOTS_TO_KMH = 1.852;

export function knotsToKmh(knots) {
  if (knots == null || Number.isNaN(knots)) return null;
  return knots * KNOTS_TO_KMH;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
const COMPASS_LONG = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];

export function compass(course) {
  if (course == null) return null;
  const i = Math.round((((course % 360) + 360) % 360) / 45) % 8;
  return { short: COMPASS[i], long: COMPASS_LONG[i] };
}

const timeFmt = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const dateTimeFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

export function clockTime(date) {
  return timeFmt.format(date);
}

/** Marca de tiempo absoluta: solo la hora si es de hoy, fecha + hora si no. */
export function absoluteTime(date, now = new Date()) {
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay ? timeFmt.format(date) : dateTimeFmt.format(date);
}

/** "Hace unos segundos", "Hace 3 min", "Hace 2 h", "Hace 4 días". */
export function relativeTime(date, now = Date.now()) {
  const s = Math.max(0, Math.round((now - date.getTime()) / 1000));
  if (s < 10) return 'Hace unos segundos';
  if (s < 60) return `Hace ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `Hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Hace 1 día' : `Hace ${d} días`;
}

export function coords(lat, lon) {
  return {
    lat: `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'N' : 'S'}`,
    lon: `${Math.abs(lon).toFixed(5)}° ${lon >= 0 ? 'E' : 'O'}`,
  };
}

export const STATUS_META = {
  online: { label: 'En línea', tone: 'online' },
  offline: { label: 'Desconectado', tone: 'offline' },
  unknown: { label: 'Sin señal reciente', tone: 'unknown' },
};

export function statusMeta(status) {
  return STATUS_META[status] ?? STATUS_META.unknown;
}
