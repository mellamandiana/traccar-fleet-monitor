import { useEffect, useRef, useState } from 'react';
import { useNow } from '../hooks/useEnvironment.js';
import { ERROR_COPY, ErrorKind } from '../api/errors.js';
import { RetryIcon, SignalLostIllustration } from './Icons.jsx';

/**
 * Estado de error empático: dice qué pasó, que no es culpa del operador y qué
 * puede hacer ahora. El foco se mueve al título para que teclado y lector de
 * pantalla aterricen directamente en la explicación.
 */
export default function ErrorState({ error, serverLabel, onRetry, onSwitchServer, nextAttemptAt, compact = false }) {
  const now = useNow(1000);
  const autoIn = nextAttemptAt ? Math.ceil((nextAttemptAt - now) / 1000) : null;
  const copy = ERROR_COPY[error?.kind] ?? ERROR_COPY[ErrorKind.UNKNOWN];
  const titleRef = useRef(null);
  const [retrying, setRetrying] = useState(false);

  // Solo al aparecer: los reintentos automáticos fallidos no deben robar el foco una y otra vez.
  useEffect(() => {
    if (!compact) titleRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setRetrying(false), [error]);

  const retry = () => {
    setRetrying(true);
    onRetry();
  };

  return (
    <div className={`error-state ${compact ? 'error-state--compact' : ''}`}>
      <SignalLostIllustration />
      {/* Solo el mensaje es región de alerta; la cuenta atrás de abajo no se anuncia cada segundo. */}
      <div role="alert" className="error-state__message">
        <h2 className="error-state__title" tabIndex={-1} ref={titleRef}>
          {copy.title}
        </h2>
        <p className="error-state__body">{copy.body}</p>
      </div>

      <div className="error-state__actions">
        <button type="button" className="button button--primary" onClick={retry} disabled={retrying} aria-busy={retrying}>
          {retrying ? <span className="spinner" aria-hidden="true" /> : <RetryIcon width={18} height={18} />}
          {retrying ? 'Reintentando…' : copy.action}
        </button>
        {onSwitchServer && (
          <button type="button" className="button button--ghost" onClick={onSwitchServer}>
            Cambiar de servidor
          </button>
        )}
      </div>

      {autoIn != null && !retrying && (
        <p className="error-state__auto">
          {autoIn > 0 ? `Reintento automático en ${autoIn} s` : 'Reintentando automáticamente…'}
        </p>
      )}

      <details className="error-state__details">
        <summary>Detalle técnico</summary>
        <p>
          {serverLabel ? `Servidor: ${serverLabel}. ` : ''}
          {error?.status ? `HTTP ${error.status}. ` : ''}
          {error?.message}
          {error?.kind === ErrorKind.NETWORK && !error?.status &&
            ' El navegador rechazó la conexión antes de recibir respuesta (servidor caído, sin red o bloqueo CORS).'}
        </p>
      </details>
    </div>
  );
}
