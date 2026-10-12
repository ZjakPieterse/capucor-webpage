'use client';

import { useEffect, useRef } from 'react';

/**
 * Deals a deck of `.stack-card`s inside the returned ref (CSS: "Card stacking"
 * in globals.css). Used by the problem cards and Your first 90 days.
 *
 * Every card gets the tallest card's height and the same sticky top, so each
 * card covers the one beneath completely. The top centres the card between
 * the header and the bottom of the screen. A card too tall for that (most phones)
 * sticks by its bottom edge instead: read as it scrolls in, then held while
 * the next one covers it. Heights come from the small viewport (100svh), so
 * phone toolbars showing and hiding never move the stack. While the next card
 * slides over, `--deck-p` (0..1) eases the card back and dims it: written to
 * the DOM, not state, so scrolling never re-renders, and only transform and
 * opacity animate (no filter). A `--deck-overhang` (px) on the deck reserves
 * room above each card for a badge that sits on its top edge.
 */
export function useCardDeck<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const deck = ref.current;
    if (!deck) return;
    const cards = [...deck.querySelectorAll<HTMLElement>('.stack-card')];
    if (!cards.length) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:100vh;height:100svh;visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);

    let lastKey = '';
    const layout = () => {
      const viewHeight = probe.offsetHeight || window.innerHeight;
      cards.forEach((card) => {
        card.style.minHeight = '';
      });
      const tallest = Math.max(...cards.map((card) => card.offsetHeight));
      const key = `${window.innerWidth}:${viewHeight}:${tallest}`;
      if (key !== lastKey) {
        lastKey = key;
        // A deck whose cards carry a badge above their top edge sets
        // --deck-overhang, so the badge clears the header too.
        const overhang = parseFloat(getComputedStyle(deck).getPropertyValue('--deck-overhang')) || 0;
        const header = (document.querySelector('header')?.offsetHeight ?? 64) + overhang;
        const bottom = viewHeight - 12;
        const centred = Math.round((header + bottom - tallest) / 2);
        const top = centred >= header + 12 ? centred : bottom - tallest;
        cards.forEach((card) => (card.style.top = `${top}px`));
      }
      cards.forEach((card) => {
        card.style.minHeight = `${tallest}px`;
      });
      update();
    };

    let rafId = 0;
    const update = () => {
      if (reduced) return;
      const tops = cards.map((card) => card.getBoundingClientRect().top);
      cards.forEach((card, i) => {
        const next = tops[i + 1];
        let p = 0;
        if (next !== undefined) {
          const h = card.offsetHeight;
          p = Math.min(1, Math.max(0, (h - (next - tops[i])) / h));
        }
        card.style.setProperty('--deck-p', p.toFixed(3));
      });
    };
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    let listening = false;
    const listen = (on: boolean) => {
      if (reduced || on === listening) return;
      listening = on;
      const method = on ? 'addEventListener' : 'removeEventListener';
      window[method]('scroll', onScroll, { passive: true } as AddEventListenerOptions);
    };
    const io = new IntersectionObserver(([entry]) => listen(entry.isIntersecting), {
      rootMargin: '100% 0px',
    });
    io.observe(deck);

    const ro = new ResizeObserver(() => layout());
    ro.observe(deck);
    window.addEventListener('resize', layout);
    layout();

    return () => {
      io.disconnect();
      ro.disconnect();
      probe.remove();
      listen(false);
      window.removeEventListener('resize', layout);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return ref;
}
