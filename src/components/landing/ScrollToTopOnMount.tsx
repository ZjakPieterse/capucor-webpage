'use client';

import { useEffect } from 'react';

export function ScrollToTopOnMount() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.history.scrollRestoration = 'manual';
    } catch {
      /* ignore — older browsers */
    }

    // Arriving with an anchor (e.g. /#contact from another page): scroll to the
    // target section instead of forcing the top. Defer past first paint so the
    // section is laid out before we measure it.
    const id = window.location.hash.slice(1);
    if (id) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = document.getElementById(id);
          if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
        });
      });
      return;
    }

    window.scrollTo(0, 0);
  }, []);

  return null;
}
