/**
 * Servidores de demostración de Traccar.
 *
 * El navegador nunca habla directo con traccar.org: todas las llamadas pasan por
 * `/proxy/<id>/api/...` en nuestro mismo origen. Así evitamos el bloqueo CORS y la
 * cookie de sesión (JSESSIONID) queda como first-party.
 *
 * - En desarrollo el proxy lo hace Vite (vite.config.js).
 * - En producción lo hacen las reglas de vercel.json / public/_redirects.
 *
 * Si añades un servidor aquí, añade también su regla en esos tres archivos.
 */
export const SERVERS = [
  { id: 'demo4', label: 'demo4.traccar.org', origin: 'https://demo4.traccar.org' },
  { id: 'demo3', label: 'demo3.traccar.org', origin: 'https://demo3.traccar.org' },
  { id: 'demo2', label: 'demo2.traccar.org', origin: 'https://demo2.traccar.org' },
  { id: 'demo', label: 'demo.traccar.org', origin: 'https://demo.traccar.org' },
];

export const DEFAULT_SERVER_ID = import.meta.env.VITE_DEFAULT_SERVER || 'demo4';

/** Cada cuánto se consulta la posición del vehículo seleccionado. */
export const POSITION_POLL_MS = Number(import.meta.env.VITE_POSITION_POLL_MS) || 5000;

/** Cada cuánto se refresca la lista de dispositivos (estado online/offline). */
export const DEVICES_POLL_MS = 30000;

/** Tiempo máximo de espera por petición antes de considerarla fallida. */
export const REQUEST_TIMEOUT_MS = 12000;

export function apiBase(serverId) {
  return `/proxy/${serverId}/api`;
}

export function serverById(id) {
  return SERVERS.find((s) => s.id === id) ?? SERVERS[0];
}
