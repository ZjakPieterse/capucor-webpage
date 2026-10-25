#!/usr/bin/env node
/**
 * Fail if the built CSS carries `-webkit-backdrop-filter` in a rule WITHOUT the
 * unprefixed `backdrop-filter` beside it.
 *
 * ⚠️ MEASURED 2026-10-25. Tailwind v4's production optimise step (Lightning CSS)
 * folds `backdrop-filter: X; -webkit-backdrop-filter: X;` into the prefixed
 * declaration alone. Chrome ignores the prefixed form, so every hand-written
 * frosted-glass rule in globals.css shipped without its blur in Chrome, and
 * nothing noticed. Writing only the standard property lets Lightning CSS emit
 * both. This check stops a well-meant "add the Safari prefix" edit from
 * bringing the bug back.
 *
 * Usage: node scripts/check-built-css.mjs [dir]   (default: .next/static/css)
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PREFIXED = /(?:^|;)\s*-webkit-backdrop-filter\s*:/;
const STANDARD = /(?:^|;)\s*backdrop-filter\s*:/;

/**
 * Selectors of every rule whose body has the prefixed property but not the
 * standard one. Nested at-rules need no special case: the innermost `{…}` of
 * `@media(…){.a{…}}` is still a plain rule body.
 */
export function findPrefixOnlyBackdropFilters(css) {
  const offenders = [];
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (PREFIXED.test(body) && !STANDARD.test(body)) offenders.push(selector.trim());
  }
  return offenders;
}

function cssFiles(directory) {
  const found = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.css')) found.push(full);
    }
  };
  walk(directory);
  return found;
}

function main() {
  const directory = resolve(process.argv[2] ?? join('.next', 'static', 'css'));
  if (!existsSync(directory)) {
    console.error(`✗ ${directory} does not exist — run the build first.`);
    process.exit(1);
  }
  const files = cssFiles(directory);
  if (files.length === 0) {
    console.error(`✗ No .css files under ${directory}, so nothing was checked.`);
    process.exit(1);
  }

  let failed = false;
  for (const file of files) {
    for (const selector of findPrefixOnlyBackdropFilters(readFileSync(file, 'utf8'))) {
      console.error(`✗ ${file}: "${selector}" has -webkit-backdrop-filter but no backdrop-filter`);
      failed = true;
    }
  }
  if (failed) {
    console.error(
      '\nChrome ignores the prefixed form. In the source, write only `backdrop-filter`;\n' +
        'the build adds `-webkit-` itself. See the header of scripts/check-built-css.mjs.',
    );
    process.exit(1);
  }
  console.log(`✓ No prefix-only backdrop-filter in ${files.length} CSS file(s).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
