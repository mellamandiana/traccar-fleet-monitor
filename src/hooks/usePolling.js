import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorKind } from '../api/errors.js';

const MAX_BACKOFF_MS = 60000;

/**
 * Consulta periódica con tres decisiones de UX incorporadas:
 *
 * 1. Si el PRIMER intento falla → `status: 'error'` (pantalla de error con reintento
 *    manual y también automático, para pantallas desatendidas).
 * 2. Si falla DESPUÉS de tener datos → se conservan los últimos datos (`isStale`)
 *    y se reintenta solo con espera exponencial (5 s, 10 s, 20 s… hasta 60 s).
 *    El operador nunca pierde la última posición conocida por un fallo de red.
 * 3. Se pausa cuando la pestaña no está visible y se refresca al volver.
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
    setState({ status: 'loading', data: undefined, error: null, failures: 0, lastSuccessAt: null, nextAttemptAt: null });

    const run = async () => {
      clearTimeout(timerRef.current);
      if (document.hidden) return; // se reanuda en visibilitychange
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const data = await fetcherRef.current(controller.signal);
        if (!alive || controller.signal.aborted) return;
        failuresRef.current = 0;
        hasDataRef.current = true;
        setState({ status: 'ready', data, error: null, failures: 0, lastSuccessAt: Date.now(), nextAttemptAt: Date.now() + interval });
        schedule(interval);
      } catch (error) {
        if (!alive || controller.signal.aborted || error?.name === 'AbortError') return;
        if (error?.kind === ErrorKind.AUTH) {
          authRef.current?.(error);
          return;
        }
        failuresRef.current += 1;
        const failures = failuresRef.current;
        const wait = Math.min(MAX_BACKOFF_MS, interval * 2 ** (failures - 1));
        setState((s) => ({
          ...s,
          status: hasDataRef.current ? 'ready' : 'error',
          error,
          failures,
          nextAttemptAt: Date.now() + wait,
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

    return () => {
      alive = false;
      clearTimeout(timerRef.current);
      controllerRef.current?.abort();
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // `key` reinicia el ciclo (p. ej. al cambiar de vehículo).
  }, [enabled, interval, key, schedule]);

  const retry = useCallback(() => {
    setState((s) => (s.status === 'error' ? { ...s, status: 'loading', error: null } : s));
    runRef.current();
  }, []);

  return { ...state, isStale: state.status === 'ready' && state.error != null, retry };
}
