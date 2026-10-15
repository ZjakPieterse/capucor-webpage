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

/** Source with comments removed, so a commented-out gate does not count. */
const code = (p: string) =>
  readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('internal routes are gated', () => {
  const pages = walk(INTERNAL_PAGES).filter((f) => /[\\/](page|layout)\.tsx?$/.test(f));
  const pageRoutes = walk(INTERNAL_PAGES).filter((f) => /[\\/]route\.tsx?$/.test(f));
  const apiRoutes = walk(INTERNAL_API).filter((f) => /[\\/]route\.tsx?$/.test(f));

  it('finds the internal pages (sanity)', () => {
    expect(pages.map(rel)).toContain('src/app/(internal)/internal-tools/page.tsx');
  });

  for (const file of pages) {
    it(`${rel(file)} awaits requireInternalPage() before any data access`, () => {
      const src = code(file);
      const gate = src.search(/await\s+requireInternalPage\(\)/);
      expect(gate).toBeGreaterThanOrEqual(0);
      const data = src.search(/createSupabase\w*Client\(|\.from\(|\.rpc\(|fetch\(/);
      if (data >= 0) expect(gate).toBeLessThan(data);
    });
  }

  for (const file of [...pageRoutes, ...apiRoutes]) {
    it(`${rel(file)} starts every handler with guardInternalApi()`, () => {
      const src = code(file);
      const handlers = [...src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b[^{]*\{/g)];
      expect(handlers.length).toBeGreaterThan(0);
      for (const h of handlers) {
        // The first statement of the body must be the guard.
        const body = src.slice(h.index! + h[0].length).trimStart();
        expect(body, h[1]).toMatch(/^const\s+\w+\s*=\s*await\s+guardInternalApi\(/);
      }
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
