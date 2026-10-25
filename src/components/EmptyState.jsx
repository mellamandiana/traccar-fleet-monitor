import { RetryIcon } from './Icons.jsx';
import { clockTime } from '../utils/format.js';

/**
 * Cuenta sin vehículos. "Recargar vehículos" vuelve a consultar /api/devices y SIEMPRE
 * da señal: "Buscando vehículos…" mientras consulta y, al terminar, la hora de la
 * comprobación. Si aparece un vehículo, el monitor sustituye esta pantalla solo.
 * La lista también se vuelve a consultar sola cada 30 s.
 */
export default function EmptyState({ serverLabel, onSwitchServer, onReload, onUseSimulated, checking, checkedAt }) {
  const checked = checkedAt ? clockTime(new Date(checkedAt)) : null;
  return (
    <div className="error-state">
      <svg width="120" height="96" viewBox="0 0 120 96" fill="none" aria-hidden="true" className="illustration">
        <rect x="20" y="30" width="80" height="44" rx="10" stroke="var(--line-strong)" strokeWidth="3" strokeDasharray="4 7" />
        <path d="M60 40 68 62 60 57.5 52 62Z" fill="var(--accent)" />
      </svg>
      <h2 className="error-state__title">Tu cuenta aún no tiene vehículos</h2>
      <p className="error-state__body">
        Agrega un dispositivo desde la web de {serverLabel ?? 'tu servidor'} (Configuración → Dispositivos) y vuelve a
        cargar la lista. Mientras tanto puedes explorar la app con una flota simulada.
      </p>
      <div className="error-state__actions">
        <button
          type="button"
          className="button button--primary"
          onClick={checking ? undefined : onReload}
          aria-disabled={checking || undefined}
        >
          {checking ? <span className="spinner" aria-hidden="true" /> : <RetryIcon width={18} height={18} />}
          {checking ? 'Buscando vehículos…' : 'Recargar vehículos'}
        </button>
        {onUseSimulated && (
          <button type="button" className="button button--ghost" onClick={onUseSimulated}>
            Usar la flota simulada
          </button>
        )}
      </div>
      {/* Resultado de la comprobación: visible y anunciado (polite) para lectores de pantalla. */}
      <p className="error-state__auto" aria-live="polite">
        {checking
          ? 'Consultando Traccar…'
          : checked
            ? `Comprobado a las ${checked}: todavía no hay vehículos. La lista se vuelve a revisar sola cada 30 s.`
            : ''}
      </p>
      <button type="button" className="button button--small button--ghost empty-state__switch" onClick={onSwitchServer}>
        Cambiar de servidor
      </button>
    </div>
  );
}
