// Page scrolls go through Lenis when it runs (pageScroll.ts, 2026-10-27): a
// native scroll mid-glide is ignored by Lenis and the page snaps back.

import { afterEach, describe, expect, it, vi } from 'vitest';
import type Lenis from 'lenis';
import { glideTo, jumpToTop, setPageScroller } from '@/lib/pageScroll';

const stubWindow = () => {
  const scrollTo = vi.fn();
  vi.stubGlobal('window', { scrollTo });
  return scrollTo;
};

afterEach(() => {
  setPageScroller(null);
  vi.unstubAllGlobals();
});

describe('page scroll helpers', () => {
  it('jumpToTop goes through Lenis, immediately and forced', () => {
    const native = stubWindow();
    const scrollTo = vi.fn();
    setPageScroller({ scrollTo } as unknown as Lenis);
    jumpToTop();
    expect(scrollTo).toHaveBeenCalledWith(0, { immediate: true, force: true });
    expect(native).not.toHaveBeenCalled();
  });

  it('jumpToTop falls back to the window without Lenis (reduced motion)', () => {
    const native = stubWindow();
    jumpToTop();
    expect(native).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('jumpToTop does nothing on the server', () => {
    expect(() => jumpToTop()).not.toThrow();
  });

  it('glideTo clears the navbar through Lenis, else scrolls the element into view', () => {
    const el = { scrollIntoView: vi.fn() } as unknown as HTMLElement;
    glideTo(el);
    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    const scrollTo = vi.fn();
    setPageScroller({ scrollTo } as unknown as Lenis);
    glideTo(el);
    expect(scrollTo).toHaveBeenCalledWith(el, { offset: -80, force: true });
  });
});
