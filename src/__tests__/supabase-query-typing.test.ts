/**
 * ⛔ A REPOSITORY-WIDE SWEEP, NOT AN ALLOWLIST — and the difference is the point.
 *
 * supabase-js parses the `.select()` string and derives a row shape from it, so
 * a misspelled or renamed column becomes
 * `SelectQueryError<"column 'x' does not exist on 'y'">` the moment the result
 * is ASSIGNED to a hand-written row type. Two things throw that away:
 *
 *  - `as unknown as SomeRow` — asserts a shape over the error type.
 *  - `.returns<SomeRow[]>()` / `.overrideTypes<…>()` — postgrest's own override.
 *    ⚠️ `CheckMatchingArrayTypes` returns the override VERBATIM when the parse
 *    produced a `SelectQueryError`, so this is not a weaker version of the cast,
 *    it is the same hole with a friendlier spelling. It was the one the first
 *    draft of this test missed, and it was live on the re-pricing path in both
 *    repositories.
 *
 * Either way the column list is unchecked and `tsc` stays green over it.
 *
 * ⚠️ THIS REPLACED A NINE-FILE ALLOWLIST ON 2026-09-04. `../capucor-os` cleaned
 * its casts in AE-02 and pinned the nine files it had touched. That guard is
 * correct and blind in the one direction that matters: a NEW module written with
 * the escape hatch is invisible to it, because it is not on the list. The
 * failure mode of an allowlist is that it protects the files that already
 * stopped being a problem. So this walks every production source file instead.
 *
 * ⛔ WHAT IT STILL CANNOT SEE, stated so nobody reads it as total: a single
 * `as SomeRow` (legal and sometimes right), an angle-bracket cast, a generic
 * `function rows<T>(v: unknown): T` helper, and `@ts-expect-error` above the
 * assignment. Each defeats this in one line. The sweep raises the cost of the
 * common accident; it is not a security boundary.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { readSource } from './helpers/sourceText';

const ROOT = join(process.cwd(), 'src');

/** Every spelling of "discard the parsed select shape" that this can see. */
const ESCAPE_HATCH = /\bas\s+(?:unknown|any|never)\s+as\b|\.(?:returns|overrideTypes)\s*</;

/**
 * The only permitted escape hatches in production source, with the reason and
 * the exact number of occurrences expected.
 *
 * ⛔ Adding an entry here is a decision, not a formality. A query result is
 * never a valid reason — narrow the JSON at the boundary instead, the way
 * `src/lib/portal/proposalJson.ts` does. The count is pinned so that a file
 * which legitimately needs ONE exception cannot quietly acquire a second.
 */
const ALLOWED: Record<string, { count: number; why: string }> = {
  'src/lib/rate-limit.ts': {
    count: 1,
    why:
      'The Cloudflare env binding bridge. `getCloudflareContext().env` is typed by ' +
      'the generated worker configuration, not by us, and reaching RATE_LIMIT_KV ' +
      'out of it is a runtime-binding cast, not a query result. Declared out of ' +
      'scope by AE-02 for the same reason.',
  },
};

function productionSources(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') continue;
      productionSources(full, found);
    } else if (/\.(?:tsx?|mts|cts)$/.test(entry)) {
      found.push(relative(process.cwd(), full).split(sep).join('/'));
    }
  }
  return found;
}

// Comments discuss the hazard by name in several files; only executable code
// counts. The trailing-comment pattern deliberately excludes `://` so a URL in
// a string is not read as a comment.
function executableSource(path: string): string {
  return readSource(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function hatchCount(path: string): number {
  return executableSource(path).match(new RegExp(ESCAPE_HATCH, 'g'))?.length ?? 0;
}

describe('Supabase query result typing', () => {
  const files = productionSources(ROOT);

  it('walks the whole production tree, not a list of known-good files', () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain('src/lib/portal/proposalPdf.ts');
    expect(files).toContain('src/lib/proposalPricing.ts');
    expect(files.some((f) => f.includes('__tests__'))).toBe(false);
  });

  it('strips comments without swallowing the code around them', () => {
    // ⚠️ The comment stripper is a regex with no string-literal awareness, so a
    // `/*` inside a string would blank the rest of a file and every assertion
    // below would pass over nothing. This anchor fails loudly if that happens.
    for (const path of files) {
      expect(executableSource(path).trim().length, `${path} stripped to nothing`).toBeGreaterThan(0);
    }
  });

  it('no production file erases an inferred query result', () => {
    const offenders = files.filter((path) => !(path in ALLOWED) && hatchCount(path) > 0);
    expect(offenders).toEqual([]);
  });

  it('every allowed exception still exists, still applies, and has not grown', () => {
    for (const [path, { count, why }] of Object.entries(ALLOWED)) {
      expect(why.length).toBeGreaterThan(40);
      expect(files, `${path} is allow-listed but no longer exists`).toContain(path);
      // Presence alone would let a file with one legitimate exception absorb any
      // number of new ones under the same reviewed-looking entry.
      expect(hatchCount(path), `${path}: expected exactly ${count} allowed escape hatch(es)`).toBe(
        count,
      );
    }
  });
});
