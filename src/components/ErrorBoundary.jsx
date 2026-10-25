import { Component } from 'react';
import { RetryIcon, SignalLostIllustration } from './Icons.jsx';

/**
 * Red de seguridad: si un componente lanza una excepción al pintar, React
 * desmontaría todo y el operador vería una página en blanco. Aquí se captura y se
 * muestra una pantalla de error empática con la misma estética del resto.
 *
 * "Volver a cargar la vista" reintenta el render sin perder la sesión; si el fallo
 * persiste, "Recargar la página" es la salida definitiva.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, resets: 0 };
    this.titleRef = null;
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // En producción aquí iría el envío a un servicio de monitoreo (Sentry, etc.).
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  // El foco va al título tanto si el fallo ocurre en el primer render (montaje)
  // como después (actualización).
  componentDidMount() {
    if (this.state.error) this.titleRef?.focus();
  }

  componentDidUpdate(_, prev) {
    if (this.state.error && !prev.error) this.titleRef?.focus();
  }

  reset = () => {
    this.props.onReset?.();
    this.setState((s) => ({ error: null, resets: s.resets + 1 }));
  };

  render() {
    const { error, resets } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="app__fallback app__fallback--full">
        <div className="error-state">
          <SignalLostIllustration />
          <div role="alert" className="error-state__message">
            <h1 className="error-state__title" tabIndex={-1} ref={(el) => (this.titleRef = el)}>
              Algo falló al mostrar esta pantalla
            </h1>
            <p className="error-state__body">
              Es un error de la aplicación, no de tu conexión ni de Traccar. Volver a cargar la vista suele resolverlo y
              tu sesión se mantiene.
            </p>
          </div>
          <div className="error-state__actions">
            <button type="button" className="button button--primary" onClick={this.reset}>
              <RetryIcon width={18} height={18} />
              Volver a cargar la vista
            </button>
            {resets > 0 && (
              <button type="button" className="button button--ghost" onClick={() => window.location.reload()}>
                Recargar la página
              </button>
            )}
          </div>
          <details className="error-state__details">
            <summary>Detalle técnico</summary>
            <p>{String(error?.message || error)}</p>
          </details>
        </div>
      </main>
    );
  }
}
