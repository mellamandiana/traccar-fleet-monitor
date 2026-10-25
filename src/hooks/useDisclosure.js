import { useCallback, useEffect, useId, useRef, useState } from 'react';

/**
 * Patrón "disclosure" (botón que muestra/oculta un panel), según WAI-ARIA APG:
 * - el botón lleva aria-expanded y aria-controls;
 * - el panel va justo después del botón en el DOM, así Tab entra en él con naturalidad;
 * - Escape cierra y devuelve el foco al botón;
 * - un clic o un foco fuera del conjunto lo cierra (sin robar el foco).
 */
export function useDisclosure({ onOpen } = {}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const panelId = useId();
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  const toggle = useCallback(() => {
    setOpen((o) => {
      if (!o) onOpenRef.current?.();
      return !o;
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(true);
      }
    };
    const onPointer = (e) => {
      if (!rootRef.current?.contains(e.target)) close(false);
    };
    const onFocus = (e) => {
      if (!rootRef.current?.contains(e.target)) close(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('focusin', onFocus);
    };
  }, [open, close]);

  return {
    open,
    close,
    rootRef,
    buttonProps: {
      ref: buttonRef,
      'aria-expanded': open,
      'aria-controls': panelId,
      onClick: toggle,
    },
    panelProps: { id: panelId, hidden: !open },
  };
}
