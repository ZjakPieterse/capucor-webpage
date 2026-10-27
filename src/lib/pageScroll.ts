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

/** Glides the page to an element, clear of the sticky navbar. Same reason as above. */
export function glideTo(el: HTMLElement) {
  if (lenis) lenis.scrollTo(el, { offset: -80, force: true });
  else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
