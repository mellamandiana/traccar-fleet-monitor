/**
 * Esqueletos con las MISMAS dimensiones que el contenido final: cuando llegan los
 * datos se reemplazan bloque por bloque sin desplazar nada (CLS ≈ 0).
 */
const Bone = ({ w = '100%', h = 14, r, className = '' }) => (
  <span className={`bone ${className}`} style={{ width: w, height: h, borderRadius: r }} aria-hidden="true" />
);

export function StatusCardSkeleton() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="status-card__head">
        <div className="status-card__id">
          <Bone w="62%" h={26} />
          <Bone w="34%" h={14} className="bone--gap" />
        </div>
      </div>
      <div className="readouts">
        <div className="readout readout--status">
          <Bone w={70} h={12} />
          <Bone w={104} h={28} r={999} />
        </div>
        <div className="readout readout--speed">
          <Bone w={70} h={12} />
          <Bone w="58%" h={64} />
          <Bone w="100%" h={6} r={4} />
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div className="readout" key={i}>
            <Bone w="60%" h={12} />
            <Bone w="82%" h={20} />
            <Bone w="44%" h={14} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DeviceListSkeleton({ rows = 5 }) {
  return (
    <ul className="device-list__items" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="device-row device-row--skeleton">
          <Bone w={10} h={10} r={999} />
          <span className="device-row__text">
            <Bone w={`${70 - i * 6}%`} h={16} />
            <Bone w="40%" h={12} />
          </span>
          <Bone w={64} h={12} />
        </li>
      ))}
    </ul>
  );
}

export function MapSkeleton({ label }) {
  return (
    <div className="map-skeleton" role="status">
      <svg className="map-skeleton__roads" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <path d="M-10 210 C 90 180, 140 120, 230 130 S 360 90, 420 40" />
        <path d="M60 -10 C 80 80, 120 160, 110 320" />
        <path d="M-10 90 C 120 100, 260 170, 420 160" />
        <path d="M280 -10 C 260 90, 300 200, 260 320" />
      </svg>
      <div className="map-skeleton__beacon" aria-hidden="true">
        <span />
      </div>
      <p className="map-skeleton__label">{label}</p>
    </div>
  );
}

export function BootSkeleton() {
  return (
    <div className="boot" role="status" aria-live="polite">
      <span className="spinner spinner--lg" aria-hidden="true" />
      <span>Recuperando tu sesión…</span>
    </div>
  );
}
