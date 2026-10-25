/**
 * globals.css keeps its unprefixed `backdrop-filter` through the production
 * CSS optimise step.
 *
 * ⚠️ MEASURED 2026-10-25: Tailwind v4's optimise step (Lightning CSS) turned
 * `backdrop-filter: X; -webkit-backdrop-filter: X;` into the prefixed form
 * alone, so the frosted glass never rendered in Chrome on capucor.com. Test 3
 * runs the real stylesheet through the same plugin with minify on, as
 * `next build` does, then through the checker CI runs on the built output.
 * Tests 1 and 2 prove the checker bites and stays quiet correctly, so 3 cannot
 * pass vacuously.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

import { findPrefixOnlyBackdropFilters } from '../../scripts/check-built-css.mjs';

const GLOBALS = join(process.cwd(), 'src', 'app', 'globals.css');

async function optimise(css: string): Promise<string> {
  const result = await postcss([
    tailwind({ base: process.cwd(), optimize: { minify: true } }),
  ]).process(css, { from: GLOBALS });
  return result.css;
}

describe('backdrop-filter survives the production CSS build', () => {
  it('1. the checker FLAGS a prefix-only rule, top-level or nested in an at-rule', () => {
    expect(findPrefixOnlyBackdropFilters('.x{-webkit-backdrop-filter:blur(1px)}')).toEqual(['.x']);
    expect(
      findPrefixOnlyBackdropFilters('@media(min-width:1px){.y{color:red;-webkit-backdrop-filter:none}}'),
    ).toEqual(['.y']);
  });

  it('2. the checker PASSES a rule that carries both forms', () => {
    expect(
      findPrefixOnlyBackdropFilters('.x{-webkit-backdrop-filter:blur(1px);backdrop-filter:blur(1px)}'),
    ).toEqual([]);
    // transition-property lists the names as values; those are not declarations.
    expect(
      findPrefixOnlyBackdropFilters('.t{transition-property:-webkit-backdrop-filter,backdrop-filter}'),
    ).toEqual([]);
  });

  it('3. globals.css, optimised as in production, keeps the standard property', async () => {
    const built = await optimise(readFileSync(GLOBALS, 'utf8'));

    expect(findPrefixOnlyBackdropFilters(built)).toEqual([]);
    // Anchor: the glass rule must be there with its standard blur, or the
    // empty list above proves nothing.
    expect(built).toMatch(/\.premium-glass\{[^}]*(?:^|;)backdrop-filter:blur\(18px\)/);
  }, 60_000);
});
