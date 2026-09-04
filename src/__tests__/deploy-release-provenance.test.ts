/**
 * The deployment-provenance gates in `.github/workflows/deploy.yml`.
 *
 * WHY A TEST READS A WORKFLOW. These gates only ever run inside a production
 * deployment, which is the one thing nothing here may trigger. So the suite
 * cannot execute them — but it can hold their SHAPE, and the shape is where the
 * mistakes live: a gate that stops asserting, a value that quietly becomes
 * public, a production secret that migrates into a workflow that runs on every
 * push. Each of those leaves every other check green.
 *
 * ⚠️ Hand-synced with
 * ../capucor-os/src/__tests__/deploy-release-provenance.test.ts.
 * Both repositories carry the same gates for the same reason; see
 * contracts/cross-repo-contract.json → releaseProvenance.
 *
 * ⚠️ THE WATCHDOG ASSERTION AT THE END IS THE ONE THAT MATTERS MOST. The
 * cross-repo contract records why the deployed-SHA question was left open:
 * asking it needs SUPABASE_SERVICE_ROLE_KEY, and putting a production secret in
 * a job that runs on EVERY push was judged a worse trade than the gap. This
 * change asks the question from the manual deploy workflow, which already holds
 * that key. If the same check ever migrates into watchdog.yml it will look like
 * an improvement — continuous instead of once — and it will have made exactly
 * the trade that was refused.
 */
import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Read a repository file with line endings normalised to LF.
 *
 * ⚠️ core.autocrlf is true on the Windows development box, so .yml and .ts are
 * CRLF on disk while the committed blob is LF. A needle containing a newline
 * would then match nothing — and a NEGATIVE assertion that matches nothing
 * passes vacuously and protects exactly as much as no assertion at all.
 */
function readSource(...parts: string[]): string {
  return readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
}

const deploy = readSource('.github', 'workflows', 'deploy.yml');
const watchdog = readSource('.github', 'workflows', 'watchdog.yml');
const nextConfig = readSource('next.config.ts');
const healthRoute = readSource('src', 'app', 'api', 'health', 'route.ts');

describe('release provenance — build-time injection', () => {
  it('1. injects the release into the SERVER compilation only', () => {
    // Defining it for the client compilation would inline the SHA into
    // .open-next/assets/_next/static/*, which is served unauthenticated.
    expect(nextConfig).toContain('webpack(config, { isServer, webpack })');
    expect(nextConfig).toContain('if (isServer)');
    expect(nextConfig).toContain('"process.env.CAPUCOR_RELEASE": JSON.stringify(RELEASE)');
  });

  it('2. does NOT route the release through anything that publishes it', () => {
    // `env:` in next.config and any NEXT_PUBLIC_ name both inline into the
    // client bundle by design — the same disclosure by a shorter route, and one
    // that would read as a simplification in review.
    expect(nextConfig).not.toContain('NEXT_PUBLIC_CAPUCOR_RELEASE');
    expect(nextConfig).not.toMatch(/^\s*env:\s*\{/m);
  });

  it('3. the release is served on the signed view and nowhere else', () => {
    const signedBranch = healthRoute.slice(
      healthRoute.indexOf('detailed'),
      healthRoute.indexOf(': { ok: env.ok'),
    );
    expect(signedBranch).toContain('release: currentRelease()');
    // The public branch is the object literal after the ternary's colon.
    expect(healthRoute).toContain("{ ok: env.ok, app: 'capucor-web' }");
  });
});

describe('release provenance — the deploy workflow', () => {
  it('4. deploys with the exact commit as the release identifier', () => {
    expect(deploy).toContain('CAPUCOR_RELEASE: ${{ github.sha }}');
  });

  it('5. refuses to deploy a build whose artefact does not carry the SHA', () => {
    // Without this the failure surfaces only AFTER production has changed.
    expect(deploy).toContain('- name: Assert the release SHA reached the server bundle only');
    expect(deploy).toContain('grep -rqF "$CAPUCOR_RELEASE" .open-next/server-functions');
    expect(deploy).toContain('Refusing to deploy a build with no release provenance.');
  });

  it('6. refuses to deploy if the SHA leaked into the PUBLIC client assets', () => {
    expect(deploy).toContain('grep -rqF "$CAPUCOR_RELEASE" .open-next/assets');
    expect(deploy).toContain('publishes repository metadata to anonymous visitors');
  });

  it('7. asks the deployed Worker what it is serving, through a TESTABLE verdict', () => {
    // ⚠️ THE VERDICT DELIBERATELY DOES NOT LIVE IN THIS FILE ANY MORE. Inline
    // bash could not be exercised without a real production deploy, so the one
    // case the gate exists for — a well-formed SHA that is not ours — had no
    // test at all. release-provenance.test.ts now drives every verdict.
    expect(deploy).toContain('- name: Verify the deployed release is this commit');
    expect(deploy).toContain('node scripts/release-provenance.mjs');
    expect(deploy).toContain('production is NOT serving this commit');
    // The bash must not start re-implementing the comparison it delegated.
    expect(deploy).not.toContain("jq -r '.release");
  });

  it('8. acts on all three exit codes, so a retryable verdict is not treated as a pass', () => {
    // 0 done, 1 stop, 2 ask again. Dropping the exit-1 branch would turn every
    // hard failure into six retries and then a generic timeout message; dropping
    // exit 2 would fail the deploy on the first propagation blip.
    expect(deploy).toContain('if [ "$verdict" = "0" ]; then exit 0; fi');
    expect(deploy).toContain('if [ "$verdict" = "1" ]; then exit 1; fi');
    expect(deploy).toContain('retrying in 10s');
  });

  it('8a. RUNS even when an earlier post-deploy step failed', () => {
    // ⚠️ THE FINDING THAT MATTERED MOST IN REVIEW. Each post-deploy step exits 1
    // on failure, so without a condition the first failure skips the rest — and
    // the incident where that matters is precisely the one with several faults
    // at once. A rollback PLUS an unset Worker secret would have reported only
    // the secret; the operator fixes it, re-dispatches, and the rollback is
    // never named. watchdog.yml already documents this exact reasoning.
    const guard = "if: ${{ !cancelled() && steps.deploy.outcome == 'success' }}";
    expect(deploy.split(guard).length - 1).toBeGreaterThanOrEqual(3);

    // Gated on the DEPLOY step, not bare always(): after a failed upload the
    // previous revision is legitimately still serving, and a mismatch reported
    // there is noise rather than a finding.
    expect(deploy).toContain('id: deploy');
    expect(deploy).not.toContain('if: always()');
  });

  it('8b. is never allowed to fail soft', () => {
    // continue-on-error would turn every gate in this workflow into a comment.
    expect(deploy).not.toContain('continue-on-error');
  });

  it('8c. fails closed if the public assets directory is not where it expects', () => {
    // `grep -r` exits 2 on a missing path and `set -e` does not apply inside an
    // `if` condition, so a relocated .open-next/assets took the same branch as
    // "no match" — printing a tick having searched nothing. That is the
    // disclosure half of the gate switching itself off silently.
    expect(deploy).toContain('if [ ! -d .open-next/assets ]; then');
    expect(deploy).toContain('would search nothing');
  });

  it('9. runs the provenance check AFTER the deploy, not before it', () => {
    const deployStep = deploy.indexOf('- name: Deploy (Cloudflare)');
    const preBuildGate = deploy.indexOf('- name: Assert the release SHA reached the server bundle only');
    const postDeployGate = deploy.indexOf('- name: Verify the deployed release is this commit');

    expect(preBuildGate).toBeGreaterThan(-1);
    expect(preBuildGate).toBeLessThan(deployStep);
    expect(postDeployGate).toBeGreaterThan(deployStep);
  });
});

describe('release provenance — what it deliberately does NOT do', () => {
  it('10. keeps the production secret out of the push-triggered watchdog', () => {
    // watchdog.yml runs on EVERY push and on a schedule. It has actions:read
    // and contents:read and no credential of its own, by design.
    expect(watchdog).toContain('on:');
    expect(watchdog).toMatch(/^\s{2}push:/m);
    expect(watchdog).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(watchdog).not.toContain('/api/health');
    expect(watchdog).not.toContain('CAPUCOR_RELEASE');

    // ⚠️ AN ALLOW-LIST, NOT A DENY-LIST. The contract's invariant is that this
    // workflow holds NO credential of its own — naming three secrets leaves
    // RESEND_API_KEY, CLOUDFLARE_API_TOKEN and SUPABASE_ACCESS_TOKEN unasserted,
    // and the next one nobody thought of unasserted too.
    const secrets = [...watchdog.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]);
    expect([...new Set(secrets)]).toEqual(['GITHUB_TOKEN']);
  });

  it('11. states the residual rather than implying continuous detection', () => {
    // The guarantee is "the expected revision was serving immediately after
    // this deploy", not "production is still serving it". A doc that overstates
    // a control is worse than no doc, because it stops anyone looking again.
    expect(deploy).toContain('It does NOT continuously detect a');
    expect(readSource('src', 'lib', 'release.ts')).toContain(
      'continuously detect a later rollback',
    );
  });
});
