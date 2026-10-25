/* Iconos SVG en línea: heredan currentColor y son decorativos por defecto. */
const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true, focusable: 'false' };
const stroke = { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

export const SunIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="4" {...stroke} />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" {...stroke} />
  </svg>
);

export const MoonIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" {...stroke} />
  </svg>
);

export const LogoutIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" {...stroke} />
  </svg>
);

export const BellIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" {...stroke} />
    <path d="M10 21h4" {...stroke} />
  </svg>
);

export const SearchIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="6.5" {...stroke} />
    <path d="m20 20-4.2-4.2" {...stroke} />
  </svg>
);

export const RetryIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" {...stroke} />
  </svg>
);

export const CrosshairIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="7" {...stroke} />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" {...stroke} />
  </svg>
);

export const EyeIcon = ({ off, ...p }) => (
  <svg {...base} {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" {...stroke} />
    <circle cx="12" cy="12" r="3" {...stroke} />
    {off && <path d="M4 4l16 16" {...stroke} />}
  </svg>
);

export const ArrowIcon = ({ deg = 0, ...p }) => (
  <svg {...base} {...p} style={{ transform: `rotate(${deg}deg)`, transition: 'transform var(--dur-slow) var(--ease-out)' }}>
    <path d="M12 3 18.5 20 12 16.2 5.5 20Z" fill="currentColor" />
  </svg>
);

export const SignalLostIllustration = () => (
  <svg width="120" height="96" viewBox="0 0 120 96" fill="none" aria-hidden="true" focusable="false" className="illustration">
    <path d="M18 70a52 52 0 0 1 84 0" stroke="var(--line-strong)" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 9" />
    <path d="M34 72a34 34 0 0 1 52 0" stroke="var(--line-strong)" strokeWidth="3" strokeLinecap="round" />
    <path d="M50 74a15 15 0 0 1 20 0" stroke="var(--ink-subtle)" strokeWidth="3" strokeLinecap="round" />
    <circle cx="60" cy="84" r="5" fill="var(--accent)" />
    <path d="M86 16l18 18M104 16 86 34" stroke="var(--danger)" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

/* ---- Iconografía del diseño de Figma Make (trazo 1,8, puntas redondeadas) ---- */
const FIGMA_PATHS = {
  vehicle: (
    <>
      <path d="M5 17h14l-1.5-7h-11L5 17Z" />
      <path d="M7 10l1.5-4h7l1.5 4M7 17v2M17 17v2M8 14h1M15 14h1" />
    </>
  ),
  route: (
    <>
      <path d="M5 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M7.5 13.5c3-4 5.5-5 8.5-4" />
    </>
  ),
  battery: (
    <>
      <rect x="3" y="7" width="17" height="10" rx="2" />
      <path d="M20 10h2v4h-2M6 10v4M9 10v4M12 10v4M15 10v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
};

export function MetricIcon({ name, size = 16 }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {FIGMA_PATHS[name]}
    </svg>
  );
}
