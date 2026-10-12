'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Lights up each `.how-step-row` in a timeline once its `.how-badge` passes the
 * viewport centre, which is where the spine's fill tip sits
 * (useSectionScrollProgress). Written to the DOM as `data-reached`, not state,
 * so scrolling never re-renders the section (home-hydration). Reduced motion
 * marks every row reached at once.
 *
 * Shared by HowItWorks and FirstNinetyDays.
 */
export function useTimelineReach(timelineRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const rows = timelineRef.current?.querySelectorAll<HTMLElement>('.how-step-row');
    if (!rows?.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      rows.forEach((row) => (row.dataset.reached = ''));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const row = entry.target.closest<HTMLElement>('.how-step-row');
          if (!row) continue;
          // Above the centre line (intersecting, or scrolled past the top) = reached.
          const reached = entry.isIntersecting || entry.boundingClientRect.top < 0;
          if (reached) row.dataset.reached = '';
          else delete row.dataset.reached;
        }
      },
      { rootMargin: '0px 0px -50% 0px' },
    );
    rows.forEach((row) => {
      const badge = row.querySelector('.how-badge');
      if (badge) io.observe(badge);
    });
    return () => io.disconnect();
  }, [timelineRef]);
}
