'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

/**
 * Weighted, eased wheel scrolling for the marketing site (Lenis). Touch keeps
 * native scrolling (`syncTouch` off), so phones are unchanged. Skipped under
 * reduced motion. Lenis drives the real window scroll, so scroll listeners,
 * IntersectionObservers and sticky decks keep working as before.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({
      lerp: 0.1,
      anchors: { offset: -80 },
      autoRaf: true,
    });
    return () => lenis.destroy();
  }, []);

  return null;
}
