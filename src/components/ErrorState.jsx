import { useEffect, useRef } from 'react';
import { useNow } from '../hooks/useEnvironment.js';
import { ERROR_COPY, ErrorKind } from '../api/errors.js';
import { RetryIcon, SignalLostIllustration } from './Icons.jsx';

/**
 * Estado de error empático: dice qué pasó, aclara de quién es el problema y qué
 * puede hacer el operador ahora.
 *
 * - El foco va al título SOLO al aparecer; los reintentos fallidos no lo roban.
 * - El componente no se desmonta mientras se reintenta (`inFlight`): el botón
 *   pasa a "Reintentando…" y la tarjeta se queda quieta.
 * - Una barra fina muestra cuánto falta para el reintento automático.
 * - Cada intento fallido se anuncia con cortesía (aria-live polite), sin repetir
 *   la alerta completa.
 */
export default function ErrorState({
  error,
  serverLabel,
  onRetry,
  onSwitchServer,
  nextAttemptAt,
  retryDelay = 0,
  failures = 0,
  inFlight = false,
  compact = false,
}) {
  const now = useNow(1000);
  const autoIn = nextAttemptAt ? Math.max(0, Math.ceil((nextAttemptAt - now) / 1000)) : null;
  const copy = ERROR_COPY[error?.kind] ?? ERROR_COPY[ErrorKind.UNKNOWN];
  const titleRef = useRef(null);

  useEffect(() => {
    if (!compact) titleRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const waitingOnline = error?.kind === ErrorKind.OFFLINE;

  return (
    <div className={`error-state ${compact ? 'error-state--compact' : ''}`} aria-busy={inFlight || undefined}>
      <SignalLostIllustration />
      <div role="alert" className="error-state__message">
        <h2 className="error-state__title" tabIndex={-1} ref={titleRef}>
          {copy.title}
        </h2>
        <p className="error-state__body">{copy.body}</p>
      </div>

      <div className="error-state__actions">
        {/* aria-disabled (no `disabled`): un botón deshabilitado pierde el foco del teclado
            y el operador "cae" al inicio de la página. Así el foco se queda en el botón. */}
        <button
          type="button"
          className="button button--primary"
          onClick={inFlight ? undefined : onRetry}
          aria-disabled={inFlight || undefined}
        >
          {inFlight ? <span className="spinner" aria-hidden="true" /> : <RetryIcon width={18} height={18} />}
          {inFlight ? 'Reintentando…' : copy.action}
        </button>
        {onSwitchServer && (
          <button type="button" className="button button--ghost" onClick={onSwitchServer}>
            Cambiar de servidor
          </button>
        )}
      </div>

      {/* Cuenta atrás del reintento automático: texto + barra (la barra es decorativa). */}
      <div className="error-state__auto">
        {inFlight ? (
          <span>Contactando con el servidor…</span>
        ) : waitingOnline ? (
          <span>Reintentaremos en cuanto vuelva la conexión.</span>
        ) : autoIn != null ? (
          <span>Reintento automático en {autoIn} s</span>
        ) : null}
        {!inFlight && retryDelay > 0 && nextAttemptAt && (
          <span className="retry-meter" aria-hidden="true">
            <span key={nextAttemptAt} className="retry-meter__fill" style={{ animationDuration: `${retryDelay}ms` }} />
          </span>
        )}
      </div>

      <p className="visually-hidden" aria-live="polite">
        {failures > 1 && !inFlight ? `Intento ${failures} sin respuesta.` : ''}
      </p>

      <details className="error-state__details">
        <summary>Detalle técnico</summary>
        <p>
          {serverLabel ? `Servidor: ${serverLabel}. ` : ''}
          {error?.status ? `HTTP ${error.status}. ` : ''}
          {error?.message}
          {failures > 1 ? ` Intentos fallidos: ${failures}.` : ''}
          {error?.kind === ErrorKind.NETWORK &&
            !error?.status &&
            ' El navegador rechazó la conexión antes de recibir respuesta (servidor caído o bloqueo CORS).'}
        </p>
      </details>
    </div>
  );
}
