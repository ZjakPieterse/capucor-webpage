/**
 * Read a JSON request body with a hard byte cap.
 *
 * WHY THIS EXISTS. `await req.json()` reads whatever it is sent. Measured on a
 * local production build (PH-08b, 2026-08-05): a **25 MB** body was fully read
 * and JSON-parsed by /api/leads, /api/data-request and /api/proposals/sign/confirm
 * before Zod refused it — 422/400, never 413, with the read-and-parse adding
 * ~200ms of work over a 1 KB body. Next bounds Server Actions at 1 MB by default
 * (`action-handler.js` hard-codes it and answers 413) but applies **no such cap
 * to Route Handlers**, and this app's middleware does not match `/api/*`, so
 * nothing in the stack bounded these routes.
 *
 * On Workers Free that is a cheap denial of service: 10ms CPU per invocation,
 * and parsing megabytes of JSON is CPU, not I/O. Waiting on Supabase costs no
 * CPU; `JSON.parse` of a 25 MB string blows the whole budget on its own.
 *
 * TWO CHECKS, AND BOTH ARE LOAD-BEARING:
 *
 * 1. `content-length`, refused before the stream is touched. This is the one
 *    that actually saves the CPU — nothing is read and nothing is parsed.
 * 2. A running byte count while reading. A chunked request sends no
 *    `content-length` at all and a declared one can lie, so the header check
 *    alone is not a bound. This is what makes the cap true rather than polite.
 *
 * A non-numeric `content-length` deliberately falls through to (2) rather than
 * being refused: the counted read bounds it anyway, and treating a malformed
 * header as "too large" would answer 413 to something that is not.
 *
 * Callers own their own response shape — this returns a status and a message
 * rather than a NextResponse, so each route keeps the error envelope its client
 * already parses.
 *
 * ⚠️ Duplicated in capucor-os, deliberately NOT added to the hand-synced list in
 * AGENTS.md. That list exists for files where drift causes a real bug across the
 * seam (two different quotes from one selection). This is self-contained logic
 * with no cross-repo contract: each repo's routes only ever call their own copy,
 * so the copies drifting costs nothing.
 */

import type { NextRequest } from 'next/server';

export type ReadJsonResult =
  | { ok: true; body: unknown }
  | { ok: false; status: 400 | 413; error: string };

const TOO_LARGE = 'Request body is too large.';
const INVALID = 'Invalid request body.';

export async function readJsonBody(
  req: NextRequest,
  maxBytes: number,
): Promise<ReadJsonResult> {
  // 1. Refuse a credible oversized declaration before reading a single byte.
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, status: 413, error: TOO_LARGE };
  }

  // 2. Count what actually arrives.
  const stream = req.body;
  if (!stream) return { ok: false, status: 400, error: INVALID };

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let seen = 0;
  let text = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      seen += value.byteLength;
      if (seen > maxBytes) {
        // Stop pulling — otherwise the sender keeps streaming into a request
        // whose answer is already decided.
        await reader.cancel().catch(() => {});
        return { ok: false, status: 413, error: TOO_LARGE };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch {
    return { ok: false, status: 400, error: INVALID };
  }

  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400, error: INVALID };
  }
}
