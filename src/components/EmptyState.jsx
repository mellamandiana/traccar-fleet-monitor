import { RetryIcon } from './Icons.jsx';

export default function EmptyState({ serverLabel, onSwitchServer, onReload }) {
  return (
    <div className="error-state">
      <svg width="120" height="96" viewBox="0 0 120 96" fill="none" aria-hidden="true" className="illustration">
        <rect x="20" y="30" width="80" height="44" rx="10" stroke="var(--line-strong)" strokeWidth="3" strokeDasharray="4 7" />
        <path d="M60 40 68 62 60 57.5 52 62Z" fill="var(--accent)" />
      </svg>
      <h2 className="error-state__title">Tu cuenta aún no tiene vehículos</h2>
      <p className="error-state__body">
        Agrega un dispositivo desde la web de {serverLabel ?? 'tu servidor'} (Configuración → Dispositivos) y vuelve a cargar la lista. También puedes entrar con la flota simulada.
      </p>
      <div className="error-state__actions">
        <button type="button" className="button button--primary" onClick={onReload}>
          <RetryIcon width={18} height={18} /> Recargar vehículos
        </button>
        <button type="button" className="button button--ghost" onClick={onSwitchServer}>
          Cambiar de servidor
        </button>
      </div>
    </div>
  );
}
