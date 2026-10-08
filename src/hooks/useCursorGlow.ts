'use client';

import { useEffect, useRef } from 'react';

/**
 * Tracks pointer position over the attached element and writes it to
 * --cursor-x / --cursor-y CSS variables. Toggles --cursor-glow-opacity on
 * enter/leave. Pair with the .cursor-glow class in globals.css.
 *
 * Respects prefers-reduced-motion (no-op when set).
 */
export function useCursorGlow<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Measure and write once per frame, not per event: reading the rect in the
    // event handler right after last frame's write forced a layout every move.
    let raf = 0;
    let clientX = 0;
    let clientY = 0;
    function onMove(e: PointerEvent) {
      clientX = e.clientX;
      clientY = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--cursor-x', `${clientX - rect.left}px`);
        el.style.setProperty('--cursor-y', `${clientY - rect.top}px`);
      });
    }
    function onEnter() {
      el?.style.setProperty('--cursor-glow-opacity', '1');
    }
    function onLeave() {
      el?.style.setProperty('--cursor-glow-opacity', '0');
    }

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return ref;
}
