import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

/**
 * Read a repository file as text, with line endings normalised to LF.
 *
 * ⚠️ WHY THIS EXISTS, AND WHY A PLAIN `readFileSync` IS A BUG IN THIS SUITE.
 *
 * `core.autocrlf` is `true` on the Windows development machine, so git writes
 * CRLF into the worktree for every file it treats as text while the committed
 * blob stays LF. Tests that assert against repository source read as text
 * therefore see CRLF, and any needle written with an embedded `\n` matches
 * nothing. That failure has two shapes, and only one of them shouts:
 *
 *  - A POSITIVE assertion goes red. Noisy, annoying, harmless.
 *  - A NEGATIVE assertion (`not.toMatch`), or a slice taken from an `indexOf`
 *    that returned `-1`, **passes vacuously and protects nothing**. It is
 *    indistinguishable from a working guard until the day it is needed.
 *
 * The second shape is why the normalisation belongs at the read boundary rather
 * than in each assertion. Copied from `../capucor-os`, which learned it first.
 *
 * @param parts Path segments. Absolute first segment is used as-is; otherwise
 *              the path is resolved against the repository root.
 */
export function readSource(...parts: string[]): string {
  const path = isAbsolute(parts[0]) ? join(...parts) : join(process.cwd(), ...parts);
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
}
