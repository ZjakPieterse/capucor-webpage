'use client';

import { useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Every page change lands at the top of the new page. Next.js's own scroll on
 * navigation targets the page's first DOM node, and a page that renders a
 * fragment of sibling sections can land scrolled to the bottom (/pricing did,
 * 2026-10-09). A layout effect runs before paint and before any page's
 * `useEffect`, so `RevealObserver` still measures the final scroll position.
 *
 * Mounted after <main> in the (site) layout so it runs after Next's handler.
 * A URL with an anchor (/#contact) is left alone: `ScrollToTopOnMount` and
 * Next scroll to the section instead.
 */
export function ScrollToTopOnRouteChange() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    try {
      window.history.scrollRestoration = 'manual';
    } catch {
      /* ignore — older browsers */
    }
    if (window.location.hash) return;
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
