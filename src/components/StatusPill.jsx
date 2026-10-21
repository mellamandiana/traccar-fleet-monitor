import { statusMeta } from '../utils/format.js';

/**
 * Indicador de conexión. El color nunca va solo: siempre acompaña un texto y,
 * en "en línea", un pulso que indica que el dato está vivo.
 */
export default function StatusPill({ status, compact = false }) {
  const meta = statusMeta(status);
  return (
    <span className={`status status--${meta.tone} ${compact ? 'status--compact' : ''}`}>
      <span className="status__dot" aria-hidden="true" />
      <span className={compact ? 'visually-hidden' : undefined}>{meta.label}</span>
    </span>
  );
}
