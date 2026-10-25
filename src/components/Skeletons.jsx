import TraccarLogo from './TraccarLogo.jsx';

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
        <Bone w={48} h={48} r={999} />
        <div className="status-card__id">
          <Bone w="70%" h={20} />
          <span className="status-card__meta">
            <Bone w={80} h={12} />
            <Bone w={84} h={22} r={999} />
          </span>
        </div>
      </div>
      <div className="readouts">
        <div className="readout readout--speed">
          <Bone w={110} h={12} />
          <Bone w="45%" h={48} />
          <Bone w="100%" h={6} r={4} />
        </div>
        {[0, 1, 2].map((i) => (
          <div className="readout readout--row" key={i}>
            <span className="readout__skeleton-dt">
              <Bone w={30} h={30} r={999} />
              <Bone w={88} h={12} />
            </span>
            <Bone w={96} h={16} />
          </div>
        ))}
        <div className="readout readout--location">
          <Bone w="40%" h={12} />
          <Bone w="70%" h={16} />
        </div>
      </div>
    </div>
  );
}

export function DeviceListSkeleton({ rows = 5 }) {
  return (
    <ul className="device-list__items" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="device-row device-row--skeleton">
          <Bone w={36} h={36} r={999} />
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

export function MapSkeleton({ label, hint, hidden = false }) {
  // Permanece montado y se desvanece (opacidad) para que el mapa aparezca "debajo",
  // sin un corte brusco del esqueleto a las teselas.
  return (
    <div className={`map-skeleton ${hidden ? 'is-hidden' : ''}`} role={hidden ? undefined : 'status'} aria-hidden={hidden || undefined}>
      <svg className="map-skeleton__roads" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <path d="M-10 210 C 90 180, 140 120, 230 130 S 360 90, 420 40" />
        <path d="M60 -10 C 80 80, 120 160, 110 320" />
        <path d="M-10 90 C 120 100, 260 170, 420 160" />
        <path d="M280 -10 C 260 90, 300 200, 260 320" />
      </svg>
      <div className="map-skeleton__beacon" aria-hidden="true">
        <span />
      </div>
      <p className="map-skeleton__label">
        {label}
        {hint && <span className="map-skeleton__hint">{hint}</span>}
      </p>
    </div>
  );
}

/**
 * Arranque (recuperando la sesión guardada): en vez de un spinner sobre una página
 * vacía, se pinta la MISMA estructura que tendrá la app —barra, tarjeta, mapa y
 * lista— con sus esqueletos. Cuando llega la sesión, cada pieza se reemplaza en su
 * sitio y nada salta.
 */
export function BootSkeleton({ slow = false }) {
  return (
    <div className="app" aria-busy="true">
      <header className="header">
        <div className="header__brand">
          <TraccarLogo height={30} />
          <span className="header__title">Monitor de flota</span>
        </div>
      </header>
      <main className="app__layout">
        <section className="card status-card" aria-hidden="true">
          <StatusCardSkeleton />
        </section>
        <section className="map-panel">
          <div className="map-toolbar" aria-hidden="true">
            <div className="map-toolbar__title">
              <span className="live-dot" />
              <span>
                <Bone w={170} h={14} />
                <Bone w={230} h={11} className="bone--gap" />
              </span>
            </div>
          </div>
          <div className="map-stage">
            <MapSkeleton
              label="Recuperando tu sesión…"
              hint={slow ? 'Traccar está respondiendo más lento de lo normal. Seguimos esperando.' : null}
            />
          </div>
        </section>
        <section className="card device-list" aria-hidden="true">
          <div className="device-list__head">
            <Bone w={90} h={18} />
            <Bone w={92} h={14} />
          </div>
          <div className="device-list__tools">
            <Bone w="100%" h={40} r={4} />
          </div>
          <DeviceListSkeleton />
        </section>
      </main>
    </div>
  );
}
