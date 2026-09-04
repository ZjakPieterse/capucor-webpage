/**
 * Every verdict the post-deploy provenance gate can reach.
 *
 * ⚠️ WHY THIS FILE EXISTS AT ALL. The verdict used to be inline bash in
 * `deploy.yml`, and inline was where the case that matters most could not be
 * tested: **a live Worker reporting a well-formed SHA that is not the one we
 * just shipped**. That is the rollback, the wrong-account deploy, the competing
 * dispatch — the entire reason AE-05 was written — and the only way to exercise
 * it inline was to perform a real production deploy and then roll production
 * back, which nothing here may do.
 *
 * Every other verdict (`absent`, `unknown`) was reachable by a unit test and
 * had one. The untested path was the important one. Moving the decision into
 * `scripts/release-provenance.mjs` is what makes it reachable, and this is the
 * test that reaches it.
 *
 * Same shape as `deploy-drift.test.ts`, and for the same stated reason: the
 * verdicts that would actually be reached in an emergency cannot be
 * manufactured against a healthy system.
 *
 * ⚠️ Hand-synced with ../capucor-os/src/__tests__/release-provenance.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { VERDICT, evaluate, exitCodeFor } from '../../scripts/release-provenance.mjs';

const DEPLOYED = '4c9c5c7a1b2d3e4f5061728394a5b6c7d8e9f001';
const SOMETHING_ELSE = 'd2393fd0a1b2c3d4e5f60718293a4b5c6d7e8f90';

function body(release?: string | null): string {
  const payload: Record<string, unknown> = { ok: true, app: 'capucor-web' };
  if (release !== undefined) payload.release = release;
  return JSON.stringify(payload);
}

describe('release provenance — the verdict that could not be tested inline', () => {
  it('1. MISMATCH: production is serving a different, well-formed commit', () => {
    // THE CASE AE-05 EXISTS FOR. A dashboard rollback, a hand-run
    // `npx wrangler deploy`, or a deploy against the wrong Cloudflare account
    // all look exactly like this, and all leave every other check green.
    const result = evaluate({
      httpCode: 200,
      body: body(SOMETHING_ELSE),
      expected: DEPLOYED,
    });

    expect(result.verdict).toBe(VERDICT.MISMATCH);
    expect(result.ok).toBe(false);
    expect(result.actual).toBe(SOMETHING_ELSE);
    // Retryable: a deploy still propagating legitimately serves the previous
    // commit for a few seconds. The caller fails the run when attempts run out.
    expect(result.retryable).toBe(true);
    expect(exitCodeFor(result)).toBe(2);
    expect(result.message).toContain(SOMETHING_ELSE);
    expect(result.message).toContain(DEPLOYED);
  });

  it('2. MATCH: production is serving exactly what we deployed', () => {
    const result = evaluate({ httpCode: 200, body: body(DEPLOYED), expected: DEPLOYED });

    expect(result.verdict).toBe(VERDICT.MATCH);
    expect(result.ok).toBe(true);
    expect(exitCodeFor(result)).toBe(0);
  });

  it('3. MATCH on a 503: a Worker missing a runtime secret still says what it is', () => {
    // 503 means "up, and reporting a missing secret". It is an ANSWER to the
    // provenance question, and treating it as unreachable would retry six times
    // and then blame the wrong thing.
    const result = evaluate({ httpCode: 503, body: body(DEPLOYED), expected: DEPLOYED });

    expect(result.verdict).toBe(VERDICT.MATCH);
    expect(exitCodeFor(result)).toBe(0);
  });

  it('4. ABSENT: no release field — the Worker predates this, or we got the public view', () => {
    const result = evaluate({ httpCode: 200, body: body(undefined), expected: DEPLOYED });

    expect(result.verdict).toBe(VERDICT.ABSENT);
    expect(result.ok).toBe(false);
    // NOT retryable: waiting will not make an old Worker grow the field, and a
    // rejected signature will not start verifying.
    expect(result.retryable).toBe(false);
    expect(exitCodeFor(result)).toBe(1);
    expect(result.message).toContain('signature was rejected');
  });

  it('5. UNKNOWN: built without CAPUCOR_RELEASE reaching next.config.ts', () => {
    const result = evaluate({ httpCode: 200, body: body('unknown'), expected: DEPLOYED });

    expect(result.verdict).toBe(VERDICT.UNKNOWN);
    expect(result.retryable).toBe(false);
    expect(exitCodeFor(result)).toBe(1);
    expect(result.message).toContain('next.config.ts');
  });

  it('6. UNPARSEABLE is RETRYABLE — an edge error page must not kill the run', () => {
    // MEASURED CLASS OF BUG. This was `jq` in a bash assignment under
    // `set -euo pipefail`: Cloudflare answering with its own HTML error page
    // carrying a 200 or 503 during propagation killed the step on attempt 1 and
    // discarded the six-attempt retry loop written for exactly that window —
    // as the LAST step of a deploy that had already changed production.
    const result = evaluate({
      httpCode: 503,
      body: '<!DOCTYPE html><html><body>error 1101</body></html>',
      expected: DEPLOYED,
    });

    expect(result.verdict).toBe(VERDICT.UNPARSEABLE);
    expect(result.retryable).toBe(true);
    expect(exitCodeFor(result)).toBe(2);
  });

  it('7. UNREACHABLE is retryable, for every code that is not an answer', () => {
    for (const httpCode of [0, '000', 404, 500, 502, 522]) {
      const result = evaluate({ httpCode, body: '', expected: DEPLOYED });
      expect(result.verdict).toBe(VERDICT.UNREACHABLE);
      expect(result.retryable).toBe(true);
      expect(exitCodeFor(result)).toBe(2);
    }
  });

  it('8. refuses to compare against an expected value that is not a full SHA', () => {
    // Defence in depth behind the pre-deploy gate. An empty or short expected
    // value must never produce a PASS — `[ "" = "" ]` in the old inline bash
    // would have.
    const notAShaAtAll: (string | undefined)[] = ['', 'master', DEPLOYED.slice(0, 7), undefined];
    for (const expected of notAShaAtAll) {
      const result = evaluate({ httpCode: 200, body: body(DEPLOYED), expected: expected as string });
      expect(result.ok).toBe(false);
      expect(result.retryable).toBe(false);
      expect(exitCodeFor(result)).toBe(1);
    }
  });

  it('9. a matching release on a body with extra fields still matches', () => {
    // The signed response also carries env/missing. The gate reads one field.
    const result = evaluate({
      httpCode: 503,
      body: JSON.stringify({
        ok: false,
        app: 'capucor-web',
        release: DEPLOYED,
        env: { RESEND_API_KEY: false },
        missing: ['RESEND_API_KEY'],
      }),
      expected: DEPLOYED,
    });

    expect(result.verdict).toBe(VERDICT.MATCH);
  });

  it('10. never reports ok for anything but an exact match', () => {
    // The one invariant the whole gate rests on, asserted across every shape
    // this function can be handed.
    const cases = [
      { httpCode: 200, body: body(SOMETHING_ELSE) },
      { httpCode: 200, body: body('unknown') },
      { httpCode: 200, body: body(undefined) },
      { httpCode: 200, body: body(null) },
      { httpCode: 200, body: body('') },
      { httpCode: 200, body: body(DEPLOYED.toUpperCase()) },
      { httpCode: 200, body: body(DEPLOYED.slice(0, 39)) },
      { httpCode: 200, body: 'not json' },
      { httpCode: 200, body: '' },
      { httpCode: 0, body: body(DEPLOYED) },
      { httpCode: 502, body: body(DEPLOYED) },
    ];

    for (const c of cases) {
      expect(evaluate({ ...c, expected: DEPLOYED }).ok).toBe(false);
    }

    // ...and the positive control, so the above is not passing because every
    // input is rejected.
    expect(evaluate({ httpCode: 200, body: body(DEPLOYED), expected: DEPLOYED }).ok).toBe(true);
  });
});
