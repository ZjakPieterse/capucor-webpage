/**
 * Loader and digest helpers for the cross-repo contract manifest.
 *
 * ⚠️ HAND-SYNCED. This file and `cross-repo-contract.json` beside it exist in
 * capucor-docs (canonical), capucor-web and capucor-os, byte-identical. That is
 * not an accident of copy-paste — it is the only way a CI job running in ONE
 * repo's checkout can enforce a contract that spans three. The cross-repo audit
 * (`capucor-os/scripts/audit-cross-repo.mjs`) compares the three copies to each
 * other, so a drifted copy is caught by the same command it belongs to.
 *
 * Zero dependencies, plain `.mjs`, no build step: it is imported by a Node
 * script, by Vitest in two repos, and potentially by a GitHub Actions cron that
 * deliberately runs without `npm ci`.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The three repo folder names, as they sit under the workspace root. */
export const REPOS = Object.freeze({
  web: 'capucor-web',
  os: 'capucor-os',
  docs: 'capucor-docs',
});

/**
 * Read the manifest that sits beside THIS file. Every copy of contract.mjs
 * resolves its own repo's copy of the JSON, which is what makes the in-repo CI
 * test work without knowing where it is checked out.
 */
export function loadContract(dir = dirname(fileURLToPath(import.meta.url))) {
  return JSON.parse(readFileSync(join(dir, 'cross-repo-contract.json'), 'utf8'));
}

/**
 * Whitespace normalisation applied before EVERY digest.
 *
 * ⚠️ Line endings are the reason this exists. The dev box is Windows and CI is
 * Ubuntu; git may or may not be translating CRLF depending on a setting nobody
 * has looked at in months. A digest that disagrees between the two would make
 * this whole gate go red on a file nobody touched, and a gate that cries wolf
 * gets switched off — which is exactly the failure the audit exists to prevent.
 */
export function normalizeWhitespace(text) {
  return (
    text
      .replace(/\r\n?/g, '\n')
      // Trailing whitespace on a line is invisible in a diff and editors add it.
      .split('\n')
      .map((line) => line.replace(/[ \t]+$/, ''))
      .join('\n')
      // A missing or doubled final newline is not a content change.
      .replace(/\n+$/, '\n')
  );
}

/**
 * Strip `//` and block comments while respecting string literals.
 *
 * Naive comment stripping is wrong here and would be wrong SILENTLY: half these
 * files contain `https://capucor.com`, and a regex that does not know it is
 * inside a string eats the rest of the line. The scan below tracks single,
 * double and template quotes plus escapes, which is enough for the files the
 * manifest actually lists.
 *
 * KNOWN LIMIT, stated rather than hidden: it does not understand regex literals
 * containing an unbalanced quote (`/'/`). No hand-synced file has one, and the
 * failure mode is a digest mismatch a human reads — not a wrong pass.
 */
export function stripComments(text) {
  let out = '';
  let i = 0;
  let quote = null;

  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    if (quote) {
      out += ch;
      if (ch === '\\') {
        out += text[i + 1] ?? '';
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }

    if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
      continue;
    }

    if (ch === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

/**
 * `byte` — the file must be identical apart from whitespace normalisation.
 * `code` — comments and blank lines are dropped first, so each repo may carry
 *          its own explanatory banner (they all do, and they should) while the
 *          executable content still has to match.
 */
export function digest(text, mode = 'byte') {
  let body = normalizeWhitespace(text);
  if (mode === 'code') {
    body = stripComments(body)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n');
  }
  return `sha256:${createHash('sha256').update(body, 'utf8').digest('hex')}`;
}

/** Digest a file on disk, or `null` when it does not exist. */
export function digestFile(path, mode = 'byte') {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return null;
  }
  return digest(text, mode);
}
