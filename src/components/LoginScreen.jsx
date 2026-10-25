import { useEffect, useId, useRef, useState } from 'react';
import { SERVERS, serverById } from '../config.js';
import { ErrorKind, loginCopy } from '../api/errors.js';
import { EyeIcon, RetryIcon } from './Icons.jsx';
import TraccarLogo from './TraccarLogo.jsx';
import ThemeToggle from './ThemeToggle.jsx';

export default function LoginScreen({ initialServerId, notice, onSubmit, theme, onToggleTheme }) {
  const [serverId, setServerId] = useState(initialServerId);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(null); // 'login' | 'simulated'
  const [error, setError] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const errorRef = useRef(null);
  const passwordRef = useRef(null);
  const ids = { server: useId(), email: useId(), password: useId(), help: useId(), error: useId() };

  // Al aparecer un error (o cambiar de tipo) el foco va al mensaje. Si un reintento
  // falla igual, el foco se queda en el botón y solo se anuncia el nuevo intento.
  const errorKind = error?.kind;
  useEffect(() => {
    if (errorKind) errorRef.current?.focus();
  }, [errorKind]);

  async function submit(simulated) {
    // El mensaje de error NO se borra al reintentar: así el formulario no salta y
    // el operador ve que se está reintentando sobre el mismo aviso.
    setPending(simulated ? 'simulated' : 'login');
    try {
      await onSubmit({ serverId, email: email.trim(), password, simulated });
    } catch (err) {
      setError(err);
      setAttempts((n) => (err.kind === error?.kind ? n + 1 : 1));
      setPending(null);
    }
  }

  const copy = error ? loginCopy(error.kind) : null;
  const busy = pending !== null;
  const server = serverById(serverId);

  return (
    <div className="login">
      <div className="login__top">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>

      <main className="login__panel" aria-labelledby="login-title">
        <div className="login__brand">
          <TraccarLogo height={40} />
          <span className="login__product">Monitor de flota</span>
        </div>
        <h1 id="login-title" className="login__title">
          Inicia sesión para ver tus vehículos en vivo
        </h1>
        <p className="login__lead">Usa tu cuenta de Traccar. La posición se actualiza cada pocos segundos.</p>

        {notice && !error && (
          <p className="callout callout--info" role="status">
            {notice}
          </p>
        )}

        {copy && (
          <div className="callout callout--danger" tabIndex={-1} ref={errorRef} id={ids.error}>
            <div role="alert" className="callout__message">
              <strong>{copy.title}</strong>
              <span>{copy.body}</span>
            </div>
            <p className="visually-hidden" aria-live="polite">
              {attempts > 1 ? `Intento ${attempts}: el servidor sigue sin responder.` : ''}
            </p>
            <div className="callout__actions">
              {error.kind === ErrorKind.AUTH ? (
                <button
                  type="button"
                  className="button button--small button--ghost"
                  onClick={() => {
                    passwordRef.current?.focus();
                    passwordRef.current?.select();
                  }}
                >
                  Corregir la contraseña
                </button>
              ) : (
                <button
                  type="button"
                  className="button button--small button--primary"
                  onClick={pending ? undefined : () => submit(false)}
                  aria-disabled={pending === 'login' || undefined}
                >
                  {pending === 'login' ? <span className="spinner" aria-hidden="true" /> : <RetryIcon width={16} height={16} />}
                  {pending === 'login' ? 'Reintentando…' : 'Reintentar'}
                </button>
              )}
              {error.kind !== ErrorKind.AUTH && (
                <button type="button" className="button button--small button--ghost" onClick={() => submit(true)} disabled={busy}>
                  Usar la flota simulada
                </button>
              )}
            </div>
          </div>
        )}

        <form
          className="login__form"
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
          aria-describedby={error ? ids.error : undefined}
          noValidate={false}
        >
          <div className="field">
            <label htmlFor={ids.server}>Servidor</label>
            <select id={ids.server} value={serverId} onChange={(e) => setServerId(e.target.value)} disabled={busy}>
              {SERVERS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor={ids.email}>Correo o usuario</label>
            <input
              id={ids.email}
              type="text"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              aria-invalid={error?.kind === ErrorKind.AUTH || undefined}
              aria-describedby={error ? ids.error : undefined}
            />
          </div>

          <div className="field">
            <label htmlFor={ids.password}>Contraseña</label>
            <div className="field__with-action">
              <input
                id={ids.password}
                ref={passwordRef}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                aria-invalid={error?.kind === ErrorKind.AUTH || undefined}
                aria-describedby={error ? ids.error : undefined}
              />
              <button
                type="button"
                className="icon-button icon-button--inset"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                aria-label="Mostrar contraseña"
                aria-controls={ids.password}
              >
                <EyeIcon off={showPassword} />
              </button>
            </div>
          </div>

          <p className="login__help" id={ids.help}>
            En los servidores de demostración cada cuenta se crea gratis desde{' '}
            <a href={server.origin} target="_blank" rel="noreferrer">
              {server.label}
              <span className="visually-hidden"> (se abre en una pestaña nueva)</span>
            </a>
            .
          </p>

          <button type="submit" className="button button--primary button--block" disabled={busy} aria-busy={pending === 'login'}>
            {pending === 'login' ? (
              <>
                <span className="spinner" aria-hidden="true" /> Conectando con {server.label}…
              </>
            ) : (
              'Iniciar sesión'
            )}
          </button>
        </form>

        <div className="login__divider" role="separator">
          <span>o</span>
        </div>

        <button type="button" className="button button--ghost button--block" onClick={() => submit(true)} disabled={busy} aria-busy={pending === 'simulated'}>
          {pending === 'simulated' ? (
            <>
              <span className="spinner" aria-hidden="true" /> Preparando flota simulada…
            </>
          ) : (
            'Explorar con una flota simulada'
          )}
        </button>
        <p className="login__fineprint">Cinco vehículos ficticios en Bogotá. Útil si el servidor de demostración está caído o sin vehículos en movimiento.</p>
      </main>
    </div>
  );
}
