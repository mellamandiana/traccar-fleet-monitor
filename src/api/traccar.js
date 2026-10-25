import { apiBase, REQUEST_TIMEOUT_MS } from '../config.js';
import { ApiError, ErrorKind, fromResponse } from './errors.js';

/**
 * Cliente mínimo de la API REST de Traccar.
 * La autenticación es por cookie de sesión (JSESSIONID) que el servidor emite en
 * POST /api/session; por eso todas las llamadas usan credentials: 'include'.
 */
export function createTraccarClient(serverId) {
  const base = apiBase(serverId);

  async function request(path, { method = 'GET', body, headers, signal } = {}) {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);
    const onOuterAbort = () => timeout.abort();
    signal?.addEventListener('abort', onOuterAbort);

    let res;
    try {
      // Datos en vivo: nunca desde caché. `cache: 'no-store'` evita la caché del navegador
      // y el parámetro `_` (que Traccar ignora) evita que un CDN/proxy, como Netlify,
      // devuelva una respuesta guardada (p. ej. la lista vacía de antes de crear un vehículo).
      const url = method === 'GET' ? `${base}${path}${path.includes('?') ? '&' : '?'}_=${Date.now()}` : `${base}${path}`;
      res = await fetch(url, {
        method,
        body,
        cache: 'no-store',
        credentials: 'include',
        headers: { Accept: 'application/json', ...headers },
        signal: timeout.signal,
      });
    } catch (err) {
      if (signal?.aborted) throw err; // cancelación intencional: no es un error de UI
      if (timeout.signal.aborted) {
        throw new ApiError(ErrorKind.TIMEOUT, 'Tiempo de espera agotado', { cause: err });
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new ApiError(ErrorKind.OFFLINE, 'El equipo no tiene conexión a internet', { cause: err });
      }
      throw new ApiError(ErrorKind.NETWORK, 'No se pudo contactar al servidor', { cause: err });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onOuterAbort);
    }

    if (!res.ok) throw fromResponse(res, path);

    const type = res.headers.get('content-type') || '';
    if (!type.includes('application/json')) {
      // Llegó HTML (la propia app o una página de error): en esta dirección no está la API.
      // Típico al desplegar sin las reglas de proxy de vercel.json / _redirects.
      throw new ApiError(ErrorKind.API_MISSING, `Respuesta ${type || 'sin tipo'} en lugar de JSON (¿falta el proxy /proxy?)`, {
        status: res.status,
      });
    }
    return res.json();
  }

  return {
    /** 1. POST /api/session — inicia sesión. */
    login(email, password, signal) {
      return request('/session', {
        method: 'POST',
        body: new URLSearchParams({ email, password }),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal,
      });
    },

    /** Recupera la sesión existente (si la cookie sigue viva). */
    restoreSession(signal) {
      return request('/session', { signal });
    },

    async logout() {
      try {
        await fetch(`${base}/session`, { method: 'DELETE', credentials: 'include' });
      } catch {
        /* cerrar sesión localmente aunque el servidor no responda */
      }
    },

    /** 2. GET /api/devices — dispositivos visibles para el usuario. */
    getDevices(signal) {
      return request('/devices', { signal });
    },

    /** 3. GET /api/positions?deviceId= — última posición conocida del dispositivo. */
    async getLatestPosition(deviceId, signal) {
      const positions = await request(`/positions?deviceId=${encodeURIComponent(deviceId)}`, { signal });
      if (!Array.isArray(positions) || positions.length === 0) return null;
      // Traccar devuelve la última posición; por si acaso, nos quedamos con la más reciente.
      return positions.reduce((a, b) => (new Date(a.fixTime) > new Date(b.fixTime) ? a : b));
    },
  };
}
