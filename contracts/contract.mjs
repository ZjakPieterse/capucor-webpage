/**
 * Loader for the web contract (`web-contract.json` beside this file).
 *
 * WEB-OWNED since 2026-10-07 (web-standalone phase 2). This used to be a
 * byte-identical copy shared with capucor-os and capucor-docs; it is now this
 * repo's own file and is never compared with another repository. Phase 3
 * removed the digest helper with the one freeze that used it.
 *
 * Zero dependencies, plain `.mjs`, no build step: it is imported by Vitest and
 * by the watchdog scripts, which run in a workflow that deliberately skips
 * `npm ci`.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Read the manifest that sits beside this file. */
export function loadContract(dir = dirname(fileURLToPath(import.meta.url))) {
  return JSON.parse(readFileSync(join(dir, 'web-contract.json'), 'utf8'));
}
