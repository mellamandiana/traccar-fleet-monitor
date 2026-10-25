import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, ErrorKind } from '../api/errors.js';

const MAX_BACKOFF_MS = 60000;
const FIRST_RETRY_MS = 5000; // el primer reintento nunca espera más de 5 s, aunque el ciclo normal sea de 30 s

/**
 * Consulta periódica con tres decisiones de UX incorporadas:
 *
 * 1. Si el PRIMER intento falla → `status: 'error'` (pantalla de error con reintento
 *    manual y también automático, para pantallas desatendidas).
 * 2. Si falla DESPUÉS de tener datos → se conservan los últimos datos (`isStale`)
 *    y se reintenta solo con espera exponencial (5 s, 10 s, 20 s… hasta 60 s).
 *    El operador nunca pierde la última posición conocida por un fallo de red.
 * 3. Se pausa cuando la pestaña no está visible y se refresca al volver.
 * 4. Sin internet (navigator.onLine) → error específico y reintento inmediato
 *    en cuanto el equipo recupera la red, sin esperar la cuenta atrás.
 * 5. Mientras se reintenta tras un error, la pantalla de error NO se desmonta
 *    (`inFlight`): el botón muestra el progreso y el foco no salta.
 *
 * Los errores de autenticación se entregan a `onAuthError` y detienen el ciclo.
 */
export function usePolling(fetcher, { interval, enabled = true, key, onAuthError }) {
  const [state, setState] = useState({
    status: 'loading',
    data: undefined,
    error: null,
    failures: 0,
    lastSuccessAt: null,
    nextAttemptAt: null,
    retryDelay: 0,
    inFlight: false,
  });

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const authRef = useRef(onAuthError);
  authRef.current = onAuthError;

  const timerRef = useRef(null);
  const controllerRef = useRef(null);
  const failuresRef = useRef(0);
  const hasDataRef = useRef(false);
  const runRef = useRef(() => {});

  const schedule = useCallback((ms) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runRef.current(), ms);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    let alive = true;
    failuresRef.current = 0;
    hasDataRef.current = false;
    setState({ status: 'loading', data: undefined, error: null, failures: 0, lastSuccessAt: null, nextAttemptAt: null, retryDelay: 0, inFlight: false });

    const run = async () => {
      clearTimeout(timerRef.current);
      if (document.hidden) return; // se reanuda en visibilitychange
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setState((s) => (s.error ? { ...s, inFlight: true } : s));

      try {
        const data = await fetcherRef.current(controller.signal);
        if (!alive || controller.signal.aborted) return;
        failuresRef.current = 0;
        hasDataRef.current = true;
        setState({ status: 'ready', data, error: null, failures: 0, lastSuccessAt: Date.now(), nextAttemptAt: Date.now() + interval, retryDelay: 0, inFlight: false });
        schedule(interval);
      } catch (caught) {
        if (!alive || controller.signal.aborted || caught?.name === 'AbortError') return;
        // Sin red en el propio equipo: el problema no es Traccar, y el mensaje debe decirlo.
        const error =
          typeof navigator !== 'undefined' && navigator.onLine === false
            ? new ApiError(ErrorKind.OFFLINE, 'El equipo no tiene conexión a internet', { cause: caught })
            : caught;
        if (error?.kind === ErrorKind.AUTH) {
          authRef.current?.(error);
          return;
        }
        failuresRef.current += 1;
        const failures = failuresRef.current;
        const wait = Math.min(MAX_BACKOFF_MS, Math.min(interval, FIRST_RETRY_MS) * 2 ** (failures - 1));
        setState((s) => ({
          ...s,
          status: hasDataRef.current ? 'ready' : 'error',
          error,
          failures,
          nextAttemptAt: Date.now() + wait,
          retryDelay: wait,
          inFlight: false,
        }));
        // Reintento automático siempre (una pantalla de control puede quedar desatendida);
        // el botón "Reintentar" permite adelantarlo.
        schedule(wait);
      }
    };
    runRef.current = run;
    run();

    const onVisibility = () => {
      if (!document.hidden) run();
    };
    document.addEventListener('visibilitychange', onVisibility);
    // Al volver la red no esperamos la cuenta atrás: reintentamos al instante.
    const onOnline = () => {
      if (failuresRef.current > 0) run();
    };
    window.addEventListener('online', onOnline);

    return () => {
      alive = false;
      clearTimeout(timerRef.current);
      controllerRef.current?.abort();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
    };
    // `key` reinicia el ciclo (p. ej. al cambiar de vehículo).
  }, [enabled, interval, key, schedule]);

  // Reintento manual: se mantiene la pantalla actual (error o datos viejos) y solo
  // cambia el botón a "Reintentando…"; nada se desmonta ni salta.
  const retry = useCallback(() => {
    // Un reintento manual siempre da señal ("Buscando…"), haya o no error previo:
    // si la respuesta trae lo mismo, el usuario debe saber que sí se consultó.
    setState((s) => ({ ...s, inFlight: true }));
    runRef.current();
  }, []);

  return { ...state, isStale: state.status === 'ready' && state.error != null, retry };
}
