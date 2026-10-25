import { useEffect } from 'react';

/**
 * Parallax de la ilustración del login. Escribe --px / --py en el elemento y el
 * CSS mueve la capa ::before con translate3d (solo composición: sin reflow, CLS 0).
 *
 * - Ratón (hover + puntero fino): la capa se desplaza en sentido CONTRARIO al
 *   puntero, hasta ±maxShift px, siguiendo con un retardo suave (lerp por frame),
 *   lo que da sensación de profundidad detrás del panel.
 * - Táctil: acompaña el scroll a `scrollFactor` de la velocidad (la franja de la
 *   ciudad se queda un poco atrás cuando sube el formulario).
 * - Con «reducir movimiento» no se registra nada: la imagen queda quieta.
 */
export function useParallax(ref, { maxShift = 14, ease = 0.08, scrollFactor = 0.35 } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window.matchMedia !== 'function') return undefined;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

    let target = { x: 0, y: 0 };
    let current = { x: 0, y: 0 };
    let frame = 0;

    const write = () => {
      el.style.setProperty('--px', `${current.x.toFixed(2)}px`);
      el.style.setProperty('--py', `${current.y.toFixed(2)}px`);
    };

    const step = () => {
      frame = 0;
      current.x += (target.x - current.x) * ease;
      current.y += (target.y - current.y) * ease;
      write();
      if (Math.abs(target.x - current.x) > 0.05 || Math.abs(target.y - current.y) > 0.05) {
        frame = requestAnimationFrame(step);
      }
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(step);
    };

    const onPointerMove = (e) => {
      if (reduce.matches || !finePointer.matches || e.pointerType !== 'mouse') return;
      const nx = e.clientX / window.innerWidth - 0.5; // -0.5 … 0.5
      const ny = e.clientY / window.innerHeight - 0.5;
      target = { x: -nx * 2 * maxShift, y: -ny * 2 * maxShift };
      kick();
    };
    const recenter = () => {
      target = { x: 0, y: 0 };
      kick();
    };
    const onScroll = () => {
      if (reduce.matches || finePointer.matches) return;
      // El scroll ya es suave por sí mismo: se aplica directo, sin retardo.
      current = target = { x: 0, y: Math.min(window.scrollY, 800) * scrollFactor };
      write();
    };
    const onPreferenceChange = () => {
      if (reduce.matches) {
        target = current = { x: 0, y: 0 };
        write();
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', recenter);
    window.addEventListener('blur', recenter);
    window.addEventListener('scroll', onScroll, { passive: true });
    reduce.addEventListener?.('change', onPreferenceChange);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', recenter);
      window.removeEventListener('blur', recenter);
      window.removeEventListener('scroll', onScroll);
      reduce.removeEventListener?.('change', onPreferenceChange);
    };
  }, [ref, maxShift, ease, scrollFactor]);
}
