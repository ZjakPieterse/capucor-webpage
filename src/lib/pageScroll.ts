import type Lenis from 'lenis';

// The page's Lenis instance (SmoothScroll.tsx), when smooth scrolling is on.
let lenis: Lenis | null = null;

export function setPageScroller(instance: Lenis | null) {
  lenis = instance;
}

/**
 * Jumps the page to the top at once. Use this, not window.scrollTo: while
 * Lenis is still easing a wheel scroll it ignores a native scroll and carries
 * on to its old target, so a new calculator step opened mid-glide landed
 * hundreds of pixels down the page (Zjak, 2026-10-27: "it keeps jumping").
 */
export function jumpToTop() {
  if (typeof window === 'undefined') return;
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
  else window.scrollTo({ top: 0, behavior: 'auto' });
}
