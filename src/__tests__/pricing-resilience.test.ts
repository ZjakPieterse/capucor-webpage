// Pricing page resilience and dropdown scrolling (Zjak, 2026-10-13).
// 1. A stale tab after a deploy (ChunkLoadError) reloads once instead of
//    showing "unavailable".
// 2. A wheel over a dropdown list scrolls the list, not the page (Lenis).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isChunkLoadError } from '@/components/pricing/PricingErrorBoundary';

const src = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8');

describe('isChunkLoadError', () => {
  it('recognises a stale-deploy chunk failure', () => {
    const named = new Error('Loading chunk 123 failed.');
    named.name = 'ChunkLoadError';
    expect(isChunkLoadError(named)).toBe(true);
    expect(isChunkLoadError(new Error('Loading chunk app-pricing failed. (error: https://capucor.com/_next/x.js)'))).toBe(true);
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module: /x.js'))).toBe(true);
  });

  it('leaves real calculator errors alone', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError('Loading chunk 1 failed')).toBe(false);
  });
});

describe('dropdown wheel scrolling', () => {
  it('the select popup opts out of smooth scroll and Lenis allows nested scroll', () => {
    expect(src('components/ui/select.tsx')).toMatch(/data-slot="select-content"\s+data-lenis-prevent/);
    expect(src('components/ui/SmoothScroll.tsx')).toContain('allowNestedScroll: true');
  });
});
