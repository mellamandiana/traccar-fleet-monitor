import { useCallback, useEffect, useState } from 'react';

/** Tema claro/oscuro: respeta la preferencia del sistema y recuerda la elección del operador. */
export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('fm-theme', theme);
    } catch {
      /* almacenamiento no disponible: el tema simplemente no se recuerda */
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return { theme, toggle };
}

/** Reloj compartido para los textos relativos ("Hace 12 s"). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function usePrefersReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * true cuando `active` lleva más de `afterMs` encendido. Sirve para la revelación
 * progresiva en la carga: los primeros segundos solo el esqueleto (no alarmar),
 * y si la API tarda de verdad, una frase que explica qué pasa.
 */
export function useSlow(active, afterMs = 5000) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) {
      setSlow(false);
      return undefined;
    }
    const id = setTimeout(() => setSlow(true), afterMs);
    return () => clearTimeout(id);
  }, [active, afterMs]);
  return slow;
}
