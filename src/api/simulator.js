import { ApiError, ErrorKind } from './errors.js';

/**
 * Flota simulada sobre Bogotá con la MISMA interfaz que el cliente de Traccar.
 * Sirve para dos cosas: explorar la app cuando los servidores de demostración
 * están caídos o sin vehículos en movimiento, y probar los estados de error.
 *
 * Parámetro de prueba: `?fallos=0.3` en la URL hace que el 30 % de las consultas
 * de posición fallen, para observar el reintento con espera exponencial.
 */

const ROUTES = {
  calle26: [
    [4.6097, -74.0817], [4.6195, -74.0885], [4.629, -74.096], [4.6365, -74.1025],
    [4.644, -74.109], [4.652, -74.1175], [4.66, -74.126], [4.676, -74.1335], [4.693, -74.141],
  ],
  autonorte: [
    [4.67, -74.056], [4.685, -74.054], [4.7, -74.052], [4.715, -74.049],
    [4.73, -74.046], [4.745, -74.044], [4.76, -74.042],
  ],
  septima: [
    [4.598, -74.076], [4.613, -74.07], [4.628, -74.064], [4.641, -74.0605],
    [4.655, -74.056], [4.675, -74.044], [4.695, -74.031],
  ],
};

const FLEET = [
  { id: 101, name: 'Camión 07 · Refrigerado', uniqueId: 'BOG-TRK-07', route: 'calle26', base: 11, amp: 6, offset: 0, battery: 86 },
  { id: 102, name: 'Furgón 12', uniqueId: 'BOG-VAN-12', route: 'autonorte', base: 14, amp: 7, offset: 900, battery: 64 },
  { id: 103, name: 'Moto 31 · Mensajería', uniqueId: 'BOG-MOT-31', route: 'septima', base: 9, amp: 5, offset: 400, battery: 42 },
  { id: 104, name: 'Camioneta 04', uniqueId: 'BOG-PCK-04', route: 'calle26', status: 'offline', parkedAt: [4.6365, -74.1025], battery: 18 },
  { id: 105, name: 'Bus 22 · Ruta escolar', uniqueId: 'BOG-BUS-22', route: 'septima', status: 'unknown', parkedAt: [4.641, -74.0605], battery: 71 },
];

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

function distance([la1, lo1], [la2, lo2]) {
  const dLa = rad(la2 - la1);
  const dLo = rad(lo2 - lo1);
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function bearing([la1, lo1], [la2, lo2]) {
  const y = Math.sin(rad(lo2 - lo1)) * Math.cos(rad(la2));
  const x = Math.cos(rad(la1)) * Math.sin(rad(la2)) - Math.sin(rad(la1)) * Math.cos(rad(la2)) * Math.cos(rad(lo2 - lo1));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

function pointAlong(route, s) {
  for (let i = 0; i < route.length - 1; i++) {
    const d = distance(route[i], route[i + 1]);
    if (s <= d) {
      const t = d === 0 ? 0 : s / d;
      return {
        lat: route[i][0] + (route[i + 1][0] - route[i][0]) * t,
        lon: route[i][1] + (route[i + 1][1] - route[i][1]) * t,
        course: bearing(route[i], route[i + 1]),
      };
    }
    s -= d;
  }
  const last = route[route.length - 1];
  return { lat: last[0], lon: last[1], course: bearing(route[route.length - 2], last) };
}

const routeLength = (route) => route.slice(1).reduce((acc, p, i) => acc + distance(route[i], p), 0);

const START = Date.now() - 1000 * 60 * 7;
const PERIOD = 45; // segundos de la oscilación de velocidad

function simulate(v, now) {
  const t = (now - START) / 1000 + v.offset;
  if (v.status) {
    return {
      lat: v.parkedAt[0], lon: v.parkedAt[1], course: 0, speedMs: 0,
      fixTime: new Date(START - (v.status === 'offline' ? 1000 * 60 * 95 : 1000 * 60 * 14)),
    };
  }
  const route = ROUTES[v.route];
  const L = routeLength(route);
  // s(t) = base·t + amp·sin(t/P)·P  → velocidad = base + amp·cos(t/P)  (siempre > 0)
  const travelled = v.base * t + v.amp * PERIOD * Math.sin(t / PERIOD);
  const speedMs = Math.max(0, v.base + v.amp * Math.cos(t / PERIOD));
  const lap = travelled % (2 * L);
  const forward = lap <= L;
  const s = forward ? lap : 2 * L - lap;
  const p = pointAlong(route, s);
  // Pequeña detención periódica "en semáforo" para que se vea el cambio a 0 km/h.
  const stopped = Math.sin(t / 23) > 0.93;
  return {
    lat: p.lat, lon: p.lon,
    course: forward ? p.course : (p.course + 180) % 360,
    speedMs: stopped ? 0 : speedMs,
    fixTime: new Date(now - 1200),
  };
}

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

const failRate = (() => {
  try {
    return Math.min(1, Math.max(0, Number(new URLSearchParams(location.search).get('fallos')) || 0));
  } catch {
    return 0;
  }
})();

export function createSimulatedClient() {
  return {
    simulated: true,
    async login(email, _password, signal) {
      await sleep(500, signal);
      return { id: 1, name: 'Operador de prueba', email: email || 'operador@flota.test' };
    },
    async restoreSession() {
      throw new ApiError(ErrorKind.AUTH, 'Sin sesión simulada');
    },
    async logout() {},
    async getDevices(signal) {
      await sleep(900, signal);
      const now = Date.now();
      return FLEET.map((v) => ({
        id: v.id,
        name: v.name,
        uniqueId: v.uniqueId,
        status: v.status ?? 'online',
        lastUpdate: simulate(v, now).fixTime.toISOString(),
        category: v.uniqueId.includes('MOT') ? 'motorcycle' : 'truck',
      }));
    },
    async getLatestPosition(deviceId, signal) {
      await sleep(350 + Math.random() * 400, signal);
      if (Math.random() < failRate) {
        throw new ApiError(ErrorKind.NETWORK, 'Fallo simulado');
      }
      const v = FLEET.find((d) => d.id === deviceId);
      if (!v) throw new ApiError(ErrorKind.NOT_FOUND, 'Dispositivo inexistente', { status: 404 });
      const now = Date.now();
      const p = simulate(v, now);
      const drain = v.status ? 0 : Math.floor((now - START) / 1000 / 240);
      return {
        id: Math.floor(now / 1000),
        deviceId,
        fixTime: p.fixTime.toISOString(),
        latitude: p.lat,
        longitude: p.lon,
        course: p.course,
        speed: p.speedMs * 1.943844, // m/s → nudos, como lo entrega Traccar
        valid: true,
        attributes: { batteryLevel: Math.max(5, v.battery - drain), ignition: !v.status && p.speedMs > 0, motion: p.speedMs > 0 },
      };
    },
  };
}
