'use client';

import { useEffect } from 'react';

/**
 * Arms the `.reveal` fade-ups on a page (see `ScrollReveal`). Blocks already on
 * screen when it runs are marked revealed first, so nothing visible hides and
 * fades back; the rest fade up once as they scroll in. One observer for the
 * whole page. Mount once per page that uses `ScrollReveal`, after
 * `ScrollToTopOnMount` so it measures the final scroll position.
 */
export function RevealObserver() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    const vh = window.innerHeight;
    for (const el of els) {
      if (el.getBoundingClientRect().top < vh) el.setAttribute('data-revealed', '');
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute('data-revealed', '');
          io.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -60px 0px' },
    );
    for (const el of els) if (!el.hasAttribute('data-revealed')) io.observe(el);
    const root = document.documentElement;
    root.classList.add('reveal-armed');
    return () => {
      io.disconnect();
      root.classList.remove('reveal-armed');
    };
  }, []);

  return null;
}
