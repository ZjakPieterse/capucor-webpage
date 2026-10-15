/**
 * Every internal page, layout and API route must call the Access gate itself
 * (decision 2026-10-15: no proxy.ts, so there is no central gate). Adding a
 * page under app/(internal)/ or a route under app/api/internal-tools/ that
 * skips it fails here.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = join(process.cwd(), 'src', 'app');
const INTERNAL_PAGES = join(APP, '(internal)');
const INTERNAL_API = join(APP, 'api', 'internal-tools');

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const rel = (p: string) => relative(process.cwd(), p).replace(/\\/g, '/');

describe('internal routes are gated', () => {
  const pages = walk(INTERNAL_PAGES).filter((f) => /[\\/](page|layout)\.tsx?$/.test(f));
  const pageRoutes = walk(INTERNAL_PAGES).filter((f) => /[\\/]route\.tsx?$/.test(f));
  const apiRoutes = walk(INTERNAL_API).filter((f) => /[\\/]route\.tsx?$/.test(f));

  it('finds the internal pages (sanity)', () => {
    expect(pages.map(rel)).toContain('src/app/(internal)/internal-tools/page.tsx');
  });

  for (const file of pages) {
    it(`${rel(file)} awaits requireInternalPage()`, () => {
      expect(readFileSync(file, 'utf8')).toMatch(/await\s+requireInternalPage\(\)/);
    });
  }

  for (const file of [...pageRoutes, ...apiRoutes]) {
    it(`${rel(file)} gates every handler with guardInternalApi()`, () => {
      const src = readFileSync(file, 'utf8');
      const handlers = src.match(/export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g) ?? [];
      const guards = src.match(/await\s+guardInternalApi\(/g) ?? [];
      expect(handlers.length).toBeGreaterThan(0);
      expect(guards.length).toBeGreaterThanOrEqual(handlers.length);
    });
  }

  it('no internal page lives outside app/(internal)/internal-tools', () => {
    const stray = walk(APP).filter(
      (f) =>
        /[\\/]internal-tools[\\/]/.test(f) &&
        !rel(f).startsWith('src/app/(internal)/internal-tools/') &&
        !rel(f).startsWith('src/app/api/internal-tools/'),
    );
    expect(stray.map(rel)).toEqual([]);
  });
});
