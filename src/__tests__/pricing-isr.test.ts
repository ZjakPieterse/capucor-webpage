// Pricing page and ISR failure (Zjak, 2026-10-13, option a). A failed pricing
// fetch at runtime must not be cached as "unavailable" for the ISR hour: the
// page throws, so the last good page keeps serving; error.tsx covers a cold
// miss. Only the build prerender still renders the fallback, and telling the
// two apart uses an INTERNAL Next.js API, so this suite also fails if a Next
// upgrade moves or renames it.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('server-only', () => ({}));

const src = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8');

describe('pricing page failure path', () => {
  it('renders the fallback only while the build prerenders; otherwise throws', () => {
    const page = src('app/(site)/pricing/page.tsx');
    expect(page).toMatch(/if \(isBuildPrerender\(\)\) return <PricingUnavailable \/>;\s*throw new Error/);
  });

  it('a route error page shows the fallback with a retry', () => {
    const file = 'app/(site)/pricing/error.tsx';
    expect(existsSync(join(process.cwd(), 'src', file))).toBe(true);
    const error = src(file);
    expect(error.startsWith("'use client'")).toBe(true);
    expect(error).toContain('<PricingUnavailable onRetry={retry} />');
  });
});

describe('isBuildPrerender (internal Next.js API)', () => {
  it('the work store Next exposes still carries isBuildTimePrerendering', () => {
    const dts = readFileSync(
      join(process.cwd(), 'node_modules/next/dist/server/app-render/work-async-storage.external.d.ts'),
      'utf8',
    );
    expect(dts).toMatch(/readonly isBuildTimePrerendering\?: boolean;/);
  });

  it('reads the flag from the current work store', async () => {
    // Next's server runtime provides this global; plain Node does not.
    const { AsyncLocalStorage } = await import('node:async_hooks');
    (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??= AsyncLocalStorage;
    const { workAsyncStorage } = await import('next/dist/server/app-render/work-async-storage.external');
    const { isBuildPrerender } = await import('@/lib/pricing/isBuildPrerender');
    expect(isBuildPrerender()).toBe(false);
    type Store = Parameters<typeof workAsyncStorage.run>[0];
    expect(workAsyncStorage.run({ isBuildTimePrerendering: true } as Store, isBuildPrerender)).toBe(true);
    expect(workAsyncStorage.run({ isBuildTimePrerendering: false } as Store, isBuildPrerender)).toBe(false);
  });
});
