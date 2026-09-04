#!/usr/bin/env node
/**
 * Did the Worker that is live RIGHT NOW come from the commit we just deployed?
 *
 * ⚠️ Hand-synced with ../capucor-os/scripts/release-provenance.mjs.
 *
 * WHY THIS IS A SCRIPT AND NOT MORE BASH. The verdict logic started life inline
 * in `deploy.yml`, and inline is where it could not be tested: the step only
 * runs inside a production deployment, which is the one thing no check here may
 * trigger. So the case that matters most — the Worker reports a well-formed SHA
 * that is NOT the one we shipped — had no test at all, while the cases that did
 * have tests (absent, unknown) were the ones a unit test could reach anyway.
 *
 * `scripts/deploy-drift.mjs` already solved this shape in this estate: a pure
 * `evaluate()` with a test per verdict, called from a workflow. This is the
 * same pattern, for the same reason.
 *
 * ⚠️ IT REPORTS; IT DOES NOT ROLL BACK. A failure here means production is
 * serving something other than the commit this run deployed. Deciding what to
 * do about that is a human's job — see the runbook.
 *
 * ⚠️ AND THE GUARANTEE IS BOUNDED. Answering "yes" proves the expected revision
 * was serving at the moment this ran, immediately after a deploy. It says
 * nothing about ten minutes later. Continuous detection would need this to run
 * unattended with SUPABASE_SERVICE_ROLE_KEY, and the cross-repo contract
 * (`deployDrift.cannotSeeProduction`) records why the push-triggered watchdog is
 * the wrong home for that key.
 *
 * Reads no secret itself: the caller signs the request and passes in what came
 * back, so this file can be unit-tested with no credential anywhere near it.
 *
 *   node scripts/release-provenance.mjs <httpCode> <bodyFile> <expectedSha>
 *
 * Exit 0 = serving the expected commit. Exit 1 = do not treat the deploy as
 * done. Exit 2 = not yet answerable, the caller should retry.
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** A full git SHA, the only identifier this gate will compare. */
const FULL_GIT_SHA = /^[0-9a-f]{40}$/;

/**
 * Verdicts, and why each is distinct.
 *
 * ⚠️ THEY ARE NOT COLLAPSED INTO "ok / not ok" ON PURPOSE. Each has a different
 * cause and a different fix, and a gate that says only "provenance failed" is a
 * gate an operator learns to skim past.
 */
export const VERDICT = Object.freeze({
  MATCH: 'match',
  MISMATCH: 'mismatch',
  UNKNOWN: 'unknown',
  ABSENT: 'absent',
  UNPARSEABLE: 'unparseable',
  UNREACHABLE: 'unreachable',
});

/**
 * Decide what the deployed Worker just told us.
 *
 * @param {object}  input
 * @param {number|string} input.httpCode  status from /api/health, 0 if no response
 * @param {string}  input.body            raw response body
 * @param {string}  input.expected        the SHA this run deployed
 */
export function evaluate({ httpCode, body, expected }) {
  if (!FULL_GIT_SHA.test(String(expected ?? ''))) {
    // Not retryable and not the Worker's fault: we were asked to compare
    // against something that cannot be compared.
    return {
      verdict: VERDICT.MISMATCH,
      ok: false,
      retryable: false,
      actual: null,
      message:
        `The expected release "${expected}" is not a full 40-character git SHA, so ` +
        'this gate has nothing exact to compare against. Refusing to report success.',
    };
  }

  const code = Number(httpCode);

  // 200 and 503 are both ANSWERS: 503 means the Worker is up and reporting a
  // missing runtime secret, and it still tells us which commit is serving.
  // Anything else — 000 from a failed connection, a 502 from the edge, a 404 —
  // means we have not reached the app yet.
  if (code !== 200 && code !== 503) {
    return {
      verdict: VERDICT.UNREACHABLE,
      ok: false,
      retryable: true,
      actual: null,
      message: `/api/health returned ${httpCode || 'no response'}.`,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    // ⚠️ RETRYABLE, NOT FATAL. During edge propagation Cloudflare can answer
    // with its own HTML error page carrying a 200 or 503. Treating that as a
    // hard failure killed the run on the first attempt and threw away the
    // retry loop written for exactly this window.
    return {
      verdict: VERDICT.UNPARSEABLE,
      ok: false,
      retryable: true,
      actual: null,
      message:
        'The response was not JSON — most likely an edge error page while the ' +
        'deploy propagates.',
    };
  }

  const actual = parsed && typeof parsed === 'object' ? parsed.release : undefined;

  if (actual === undefined || actual === null) {
    return {
      verdict: VERDICT.ABSENT,
      ok: false,
      retryable: false,
      actual: null,
      message:
        'The signed /api/health response carried no "release" field. Either the ' +
        'deployed Worker predates release provenance, or the signature was ' +
        'rejected and this is the public view. Cannot prove what is serving.',
    };
  }

  if (actual === 'unknown') {
    return {
      verdict: VERDICT.UNKNOWN,
      ok: false,
      retryable: false,
      actual,
      message:
        'The deployed Worker reports release "unknown" — it was built without ' +
        'CAPUCOR_RELEASE reaching next.config.ts. Cannot prove what is serving.',
    };
  }

  if (actual === expected) {
    return {
      verdict: VERDICT.MATCH,
      ok: true,
      retryable: false,
      actual,
      message: `Production is serving ${expected}.`,
    };
  }

  // ⚠️ THE CASE THIS WHOLE GATE EXISTS FOR. Retryable because a deploy that is
  // still propagating legitimately serves the previous commit for a few
  // seconds; the caller stops retrying and fails the run when attempts run out.
  return {
    verdict: VERDICT.MISMATCH,
    ok: false,
    retryable: true,
    actual,
    message: `Serving ${actual}, expected ${expected}.`,
  };
}

/** Exit code for a verdict: 0 done, 2 ask again, 1 stop. */
export function exitCodeFor(result) {
  if (result.ok) return 0;
  return result.retryable ? 2 : 1;
}

function main(argv) {
  const [httpCode, bodyFile, expected] = argv;

  if (!httpCode || !bodyFile || !expected) {
    console.error('usage: release-provenance.mjs <httpCode> <bodyFile> <expectedSha>');
    return 1;
  }

  let body = '';
  try {
    body = readFileSync(bodyFile, 'utf8');
  } catch {
    // No body file at all is the same class of answer as no response.
    body = '';
  }

  const result = evaluate({ httpCode, body, expected });
  const code = exitCodeFor(result);

  if (result.ok) {
    console.log(`✓ ${result.message}`);
  } else if (result.retryable) {
    console.log(`… ${result.message}`);
  } else {
    console.error(`::error::${result.message}`);
  }

  return code;
}

// Only run when invoked directly, so importing this from a test costs nothing
// and cannot exit the test process. pathToFileURL is what makes the comparison
// correct on Windows, where argv[1] is a drive-letter path and import.meta.url
// is a file:// URL.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
