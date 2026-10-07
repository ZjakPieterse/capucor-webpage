/**
 * Loader for the web contract (`web-contract.json` beside this file), plus the
 * digest helper its one temporary freeze uses.
 *
 * WEB-OWNED since 2026-10-07 (web-standalone phase 2). This used to be a
 * byte-identical copy shared with capucor-os and capucor-docs; it is now this
 * repo's own file and is never compared with another repository.
 *
 * Zero dependencies, plain `.mjs`, no build step: it is imported by Vitest and
 * by the watchdog scripts, which run in a workflow that deliberately skips
 * `npm ci`.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Read the manifest that sits beside this file. */
export function loadContract(dir = dirname(fileURLToPath(import.meta.url))) {
  return JSON.parse(readFileSync(join(dir, 'web-contract.json'), 'utf8'));
}

/**
 * Whitespace normalisation applied before every digest.
 *
 * ⚠️ Line endings are the reason this exists. The dev box is Windows and CI is
 * Ubuntu; a digest that disagreed between the two would go red on a file
 * nobody touched, and a gate that cries wolf gets switched off.
 */
export function normalizeWhitespace(text) {
  return (
    text
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => line.replace(/[ \t]+$/, ''))
      .join('\n')
      .replace(/\n+$/, '\n')
  );
}

/** Digest a file on disk (whitespace-normalised), or `null` when it does not exist. */
export function digestFile(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return null;
  }
  return `sha256:${createHash('sha256').update(normalizeWhitespace(text), 'utf8').digest('hex')}`;
}
