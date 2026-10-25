/**
 * Iconos por tipo de vehículo, en perfil lateral, con el mismo lenguaje que la
 * iconografía del Figma: rejilla de 24 px, trazo de 1,8 px, puntas redondeadas.
 * Cada silueta se distingue por su forma (caja de carga, ventanillas del bus, dos
 * ruedas de la moto…), no solo por el detalle, para leerse bien a 20 px.
 */
const Wheels = ({ a = 6, b = 17, y = 17, r = 2 }) => (
  <>
    <circle cx={a} cy={y} r={r} />
    <circle cx={b} cy={y} r={r} />
  </>
);

const SHAPES = {
  // Camión: caja de carga alta + cabina más baja al frente
  truck: (
    <>
      <path d="M2.5 15V7a1 1 0 0 1 1-1h9.5v9" />
      <path d="M13 9h3.6l3.4 3.4V15h-1" />
      <path d="M2.5 15h1.5M8 15h6" />
      <Wheels a={6} b={16.5} />
    </>
  ),
  // Furgón: un solo volumen alargado con el morro inclinado
  van: (
    <>
      <path d="M2.5 15V8a2 2 0 0 1 2-2h9.2a2 2 0 0 1 1.4.6l4.3 4.3a2 2 0 0 1 .6 1.4V15h-1" />
      <path d="M14 6.5V10h5" />
      <path d="M2.5 15h1.5M8 15h7" />
      <Wheels a={6} b={17} />
    </>
  ),
  // Camioneta (pick-up): platón bajo atrás, cabina al frente
  pickup: (
    <>
      <path d="M2.5 15v-3.5h8V8h5l3 3.5h1.5a1 1 0 0 1 1 1V15h-1" />
      <path d="M11.5 8.5v3h5" />
      <path d="M2.5 15h1.5M8 15h7" />
      <Wheels a={6} b={17} />
    </>
  ),
  // Bus: caja larga con fila de ventanillas y puerta
  bus: (
    <>
      <rect x="2.5" y="5" width="19" height="10" rx="2" />
      <path d="M2.5 10h19M7.5 5v5M12.5 5v5M17.5 5v10" />
      <Wheels a={6.5} b={16.5} />
    </>
  ),
  // Moto: dos ruedas grandes, bloque de motor, depósito, asiento y horquilla
  motorcycle: (
    <>
      <circle cx="5" cy="16" r="3" />
      <circle cx="19" cy="16" r="3" />
      <path d="M5 16l3.2-3.8h1.3" />
      <path d="M7 10.5h3.5l1.5 1.7h2.6l2-2.4" />
      <path d="M19 16l-3.2-8H18" />
      <rect x="9.5" y="12.2" width="5" height="3.8" rx="1" />
    </>
  ),
  // Automóvil: techo curvo y capó
  car: (
    <>
      <path d="M2.5 15v-2.6a1 1 0 0 1 .7-1l2.3-.7 2-3.2A1 1 0 0 1 8.4 7h6.3a1 1 0 0 1 .8.4l2.5 3.1 2.4.6a1 1 0 0 1 .8 1V15h-1" />
      <path d="M2.5 15h1.5M8 15h7M6 10.5h12" />
      <Wheels a={6} b={17} />
    </>
  ),
  // Genérico (tipo desconocido): el vehículo frontal del Figma
  default: (
    <>
      <path d="M5 17h14l-1.5-7h-11L5 17Z" />
      <path d="M7 10l1.5-4h7l1.5 4M7 17v2M17 17v2M8 14h1M15 14h1" />
    </>
  ),
};

export const VEHICLE_LABEL = {
  truck: 'Camión',
  van: 'Furgón',
  pickup: 'Camioneta',
  bus: 'Bus',
  motorcycle: 'Moto',
  car: 'Automóvil',
  default: 'Vehículo',
};

/* Categorías de Traccar → nuestras siluetas. */
const CATEGORY_TO_KIND = {
  truck: 'truck',
  crane: 'truck',
  tractor: 'truck',
  van: 'van',
  camper: 'van',
  pickup: 'pickup',
  offroad: 'pickup',
  bus: 'bus',
  trolleybus: 'bus',
  tram: 'bus',
  motorcycle: 'motorcycle',
  scooter: 'motorcycle',
  bicycle: 'motorcycle',
  car: 'car',
};

/* Si el dispositivo no tiene categoría, se intenta por el nombre. */
const NAME_HINTS = [
  [/\b(moto|motocicleta|scooter)/i, 'motorcycle'],
  [/\b(bus|buseta|microbús|microbus)/i, 'bus'],
  [/\b(camioneta|pick-?up)/i, 'pickup'],
  [/\b(furg[oó]n|van)/i, 'van'],
  [/\b(cami[oó]n|tractomula|volqueta)/i, 'truck'],
  [/\b(auto|carro|coche|sed[aá]n|taxi)/i, 'car'],
];

export function vehicleKind(device) {
  const byCategory = CATEGORY_TO_KIND[String(device?.category || '').toLowerCase()];
  if (byCategory) return byCategory;
  const name = device?.name || '';
  for (const [re, kind] of NAME_HINTS) if (re.test(name)) return kind;
  return 'default';
}

export default function VehicleIcon({ kind = 'default', size = 20 }) {
  return (
    <svg className="icon vehicle-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {SHAPES[kind] ?? SHAPES.default}
    </svg>
  );
}
