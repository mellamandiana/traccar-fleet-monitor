import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../hooks/useEnvironment.js';

/**
 * Resalta brevemente un valor cuando cambia (fundido índigo breve).
 * No se dispara en el primer pintado: solo comunica cambios reales.
 */
export function Flash({ value, children, className = '' }) {
  const [generation, setGeneration] = useState(0);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setGeneration((g) => g + 1);
    }
  }, [value]);
  return (
    <span key={generation} className={`${className} ${generation ? 'flash' : ''}`.trim()}>
      {children}
    </span>
  );
}

/** Cifra que se desliza hasta su nuevo valor en lugar de saltar. */
export function AnimatedNumber({ value, duration = 600, format = (n) => Math.round(n).toString() }) {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const frame = useRef(0);

  useEffect(() => {
    if (value == null) return undefined;
    const from = fromRef.current ?? value;
    if (reduced || from === value) {
      fromRef.current = value;
      setDisplay(value);
      return undefined;
    }
    const start = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - (1 - k) ** 3;
      const v = from + (value - from) * eased;
      fromRef.current = v;
      setDisplay(v);
      if (k < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration, reduced]);

  return <>{display == null ? '—' : format(display)}</>;
}
