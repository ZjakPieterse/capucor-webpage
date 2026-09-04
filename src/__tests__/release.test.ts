/**
 * The release identifier, and why it is strict.
 *
 * `normaliseRelease` is the only thing standing between "production told us
 * which commit it is running" and "production told us something that merely
 * looks like an answer". deploy.yml compares its output to `github.sha` with a
 * string equality, so anything that is not a full 40-character SHA has to
 * collapse to the sentinel rather than be passed through — a short SHA, a tag
 * or a branch name would each read as provenance while proving nothing.
 *
 * ⚠️ Hand-synced with ../capucor-os/src/__tests__/release.test.ts. Both Workers
 * report a release on their signed /api/health, both deploy workflows compare
 * it the same way, and a divergence would let one repo's gate pass on a value
 * the other would reject.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { RELEASE_UNKNOWN, currentRelease, normaliseRelease } from '@/lib/release';

const SHA = '4c9c5c7a1b2d3e4f5061728394a5b6c7d8e9f001';

describe('normaliseRelease', () => {
  it('1. passes a full 40-character git SHA through unchanged', () => {
    expect(normaliseRelease(SHA)).toBe(SHA);
    expect(SHA).toHaveLength(40);
  });

  it('2. lower-cases and trims, so a build-time quirk is not a mismatch', () => {
    // github.sha is already lower-case, but a hand-run build or a future CI
    // that pipes through a shell could hand us surrounding whitespace, and a
    // deploy that fails on a stray newline helps nobody.
    expect(normaliseRelease(`  ${SHA.toUpperCase()}\n`)).toBe(SHA);
  });

  it('3. REJECTS a short SHA — the comparison in deploy.yml must be exact', () => {
    // This is the important one. A 7-character prefix satisfies a human reading
    // a log and satisfies nothing else; accepted here it would make the deploy
    // gate compare a prefix against a full SHA and fail every deploy, or worse,
    // tempt someone into a prefix comparison that two commits can share.
    expect(normaliseRelease(SHA.slice(0, 7))).toBe(RELEASE_UNKNOWN);
    expect(normaliseRelease(SHA.slice(0, 39))).toBe(RELEASE_UNKNOWN);
    expect(normaliseRelease(`${SHA}0`)).toBe(RELEASE_UNKNOWN);
  });

  it('4. rejects branch names, tags and other non-SHA identifiers', () => {
    expect(normaliseRelease('master')).toBe(RELEASE_UNKNOWN);
    expect(normaliseRelease('v0.1.0')).toBe(RELEASE_UNKNOWN);
    expect(normaliseRelease('refs/heads/master')).toBe(RELEASE_UNKNOWN);
    // 40 characters, but not hex.
    expect(normaliseRelease('z'.repeat(40))).toBe(RELEASE_UNKNOWN);
  });

  it('5. reports the sentinel rather than an empty string when nothing was set', () => {
    // An empty string would serialise to `"release": ""`, which reads as an
    // answer. The workflow distinguishes "unknown" from a mismatch and says
    // something different about each.
    expect(normaliseRelease(undefined)).toBe(RELEASE_UNKNOWN);
    expect(normaliseRelease(null)).toBe(RELEASE_UNKNOWN);
    expect(normaliseRelease('')).toBe(RELEASE_UNKNOWN);
    expect(normaliseRelease('   ')).toBe(RELEASE_UNKNOWN);
    expect(RELEASE_UNKNOWN).toBe('unknown');
  });
});

describe('currentRelease', () => {
  it('6. reads the value next.config.ts bakes into the server bundle', () => {
    vi.stubEnv('CAPUCOR_RELEASE', SHA);
    expect(currentRelease()).toBe(SHA);
    vi.unstubAllEnvs();
  });

  it('7. degrades to the sentinel when the build had no release', () => {
    vi.stubEnv('CAPUCOR_RELEASE', '');
    expect(currentRelease()).toBe(RELEASE_UNKNOWN);
    vi.unstubAllEnvs();
  });
});
