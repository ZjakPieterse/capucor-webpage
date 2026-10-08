import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// The root layout loads next/font, which only runs inside the Next compiler.
// Only its exported `metadata` is under test here.
vi.mock('@/lib/fonts', () => ({
  geistSans: { variable: '' },
  geistMono: { variable: '' },
}));

import sitemap from '@/app/sitemap';
import robots from '@/app/robots';
import { metadata as rootMetadata } from '@/app/layout';
import { siteConfig } from '@/config/site';

// Search and share metadata. Every case here was live on capucor.com
// (measured 2026-10-07): the sitemap listed 3 of 8 public pages, robots.txt
// blocked the /api/og share image, and every page's Twitter card said
// "Capucor Business Solutions" with the homepage description.

const SITE_DIR = join(__dirname, '..', 'app', '(site)');

/** URL paths of every page.tsx under app/(site)/ (route group stripped). */
function sitePagePaths(dir = SITE_DIR): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sitePagePaths(full));
    else if (name === 'page.tsx') {
      const rel = relative(SITE_DIR, dir).split(sep).filter(Boolean).join('/');
      out.push(rel === '' ? '/' : `/${rel}`);
    }
  }
  return out.sort();
}

describe('sitemap.xml', () => {
  it('lists every public (site) page, and nothing else', () => {
    const base = siteConfig.marketingUrl;
    const listed = sitemap()
      .map((e) => e.url.slice(base.length) || '/')
      .map((p) => (p === '/' ? '/' : p.replace(/\/$/, '')))
      .sort();
    expect(listed).toEqual(sitePagePaths());
  });

  it('never lists a per-client proposal page', () => {
    expect(sitemap().some((e) => e.url.includes('/proposal'))).toBe(false);
  });
});

describe('robots.txt', () => {
  it('keeps /api/ disallowed but lets crawlers fetch the share image', () => {
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    const allow = ([] as string[]).concat(rule.allow ?? []);
    const disallow = ([] as string[]).concat(rule.disallow ?? []);
    expect(disallow).toContain('/api/');
    expect(allow).toContain('/api/og');
  });
});

describe('root metadata', () => {
  it('sets no twitter title/description/images, so each page inherits its own from openGraph', () => {
    const tw = rootMetadata.twitter as Record<string, unknown>;
    expect(tw).toBeDefined();
    expect(tw.title).toBeUndefined();
    expect(tw.description).toBeUndefined();
    expect(tw.images).toBeUndefined();
  });

  it('sets no og title or url, so pages without their own openGraph do not share as the homepage', () => {
    const og = rootMetadata.openGraph as Record<string, unknown>;
    expect(og.title).toBeUndefined();
    expect(og.url).toBeUndefined();
    expect(og.siteName).toBe(siteConfig.name);
  });
});

describe('per-page metadata', () => {
  it('gives every (site) page a canonical URL and an og:site_name', () => {
    const missing: string[] = [];
    for (const path of sitePagePaths()) {
      const file = join(SITE_DIR, ...path.split('/').filter(Boolean), 'page.tsx');
      const src = readFileSync(file, 'utf8');
      if (!/canonical:/.test(src)) missing.push(`${path}: canonical`);
      if (!/siteName:/.test(src)) missing.push(`${path}: siteName`);
    }
    expect(missing).toEqual([]);
  });
});
