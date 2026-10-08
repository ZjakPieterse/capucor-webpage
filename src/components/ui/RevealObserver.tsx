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
    const reveal = (el: Element) => {
      el.setAttribute('data-revealed', '');
      io.unobserve(el);
    };
    // A fast scroll on a slow phone can carry a block from below the screen to
    // above it between two observer checks, so it is never seen intersecting
    // and would stay hidden (measured live, 2026-10-08). So: when one block
    // reveals, every block above it reveals too, and when scrolling stops,
    // everything at or above the bottom of the screen is revealed.
    const sweep = (limit: number) => {
      for (const el of els) {
        if (!el.hasAttribute('data-revealed') && el.getBoundingClientRect().top <= limit) reveal(el);
      }
    };
    const io = new IntersectionObserver(
      (entries) => {
        let lowest = -Infinity;
        for (const entry of entries) {
          if (entry.isIntersecting) lowest = Math.max(lowest, entry.boundingClientRect.top);
        }
        if (lowest > -Infinity) sweep(lowest);
      },
      { rootMargin: '0px 0px -60px 0px' },
    );
    for (const el of els) if (!el.hasAttribute('data-revealed')) io.observe(el);
    let idle = 0;
    const onScroll = () => {
      window.clearTimeout(idle);
      idle = window.setTimeout(() => sweep(window.innerHeight), 150);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    const root = document.documentElement;
    root.classList.add('reveal-armed');
    return () => {
      io.disconnect();
      window.clearTimeout(idle);
      window.removeEventListener('scroll', onScroll);
      root.classList.remove('reveal-armed');
    };
  }, []);

  return null;
}
