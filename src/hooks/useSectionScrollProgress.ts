'use client';

import { useEffect, useRef } from 'react';

/**
 * Scroll progress (0..1) anchored to viewport centre: 0 when the section's top
 * edge reaches the viewport centre, 1 when its bottom edge does. This keeps the
 * "tip" of a section-spanning progress element near vertical screen centre as
 * the user scrolls.
 *
 * Written straight to the `--scroll-progress` CSS variable on the element, not
 * React state (home-hydration, 2026-10-08): state re-rendered the whole section
 * on every scroll frame. Only listens while the section is near the viewport.
 * Honours prefers-reduced-motion by setting 1 with no listener.
 */
export function useSectionScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.setProperty('--scroll-progress', '1');
      return;
    }

    let rafId = 0;
    let last = -1;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.height <= 0) return;
      const traveled = window.innerHeight / 2 - rect.top;
      const p = Math.min(1, Math.max(0, traveled / rect.height));
      if (Math.abs(p - last) < 0.002) return;
      last = p;
      el.style.setProperty('--scroll-progress', p.toFixed(4));
    };
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };
    const listen = (on: boolean) => {
      const method = on ? 'addEventListener' : 'removeEventListener';
      window[method]('scroll', onScroll, { passive: true } as AddEventListenerOptions);
      window[method]('resize', onScroll, { passive: true } as AddEventListenerOptions);
    };
    // Track scroll only while the section is within a screen of the viewport.
    const io = new IntersectionObserver(
      ([entry]) => {
        listen(entry.isIntersecting);
        if (entry.isIntersecting) onScroll();
      },
      { rootMargin: '100% 0px' },
    );
    io.observe(el);
    update();
    return () => {
      io.disconnect();
      cancelAnimationFrame(rafId);
      listen(false);
    };
  }, []);

  return { ref };
}
