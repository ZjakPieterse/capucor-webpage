import 'server-only';

/**
 * Which commit is this Worker actually running?
 *
 * ⚠️ Hand-synced with ../capucor-os/src/lib/release.ts, and registered in
 * contracts/cross-repo-contract.json → knownDuplicates. Both Workers report a
 * release on their signed /api/health and both deploy workflows compare it the
 * same way; a divergence would let one gate accept a value the other rejects.
 *
 * WHY THIS EXISTS. `scripts/deploy-drift.mjs` asks the Actions API for the
 * newest successful deploy run and compares its `head_sha` to the tip of
 * `master`. That answers "did we intend to ship this?" and it is genuinely
 * useful — but the contract has always been explicit that it CANNOT see
 * production (`deployDrift.cannotSeeProduction`). A green deploy run proves
 * `wrangler` uploaded a build. It does not prove the Worker is serving it. A
 * dashboard rollback, a hand-run `npx wrangler deploy` from a laptop, or a
 * deploy that succeeded against the wrong Cloudflare account are all invisible
 * from the Actions API, and each of them leaves every check green.
 *
 * The missing piece was always the same one: the deployed app has to be able to
 * say which revision it is. This is that.
 *
 * ⚠️ IT IS NOT PUBLIC, AND THAT IS DELIBERATE. The value is served only on the
 * HMAC-signed /api/health response. The unauthenticated response stays exactly
 * `{ ok, app }` — exposing repository or release metadata to the open internet
 * is a disclosure decision nobody has taken, and the same reasoning that
 * narrowed the public health body in the first place applies here. It is also
 * kept out of the CLIENT bundle: `server-only` above makes importing this from
 * a client component a build error, and next.config.ts injects the value into
 * the server compilation ONLY.
 *
 * HOW THE VALUE GETS HERE. `next.config.ts` defines `process.env.CAPUCOR_RELEASE`
 * into the server bundle at build time from the build environment, so the string
 * is a literal in the compiled worker. It is NOT read from the Worker's runtime
 * environment: a Cloudflare secret is set by hand and could be edited to say
 * anything, which would make the whole check a statement about the dashboard
 * rather than about the artefact. Baking it at build time means the answer is a
 * property of the bundle that was uploaded.
 *
 * ⚠️ WHAT THE ANSWER PROVES. That the code serving this request was BUILT from
 * that commit. Paired with the post-deploy check in deploy.yml, that proves the
 * expected revision was serving immediately after the deploy. It does NOT
 * continuously detect a later rollback — nothing re-asks, and the push-triggered
 * watchdog deliberately does not carry the production secret needed to ask.
 * Closing that half needs its own design and its own decision.
 */

/** What a build with no release identifier reports. Never a silent empty string. */
export const RELEASE_UNKNOWN = 'unknown';

const FULL_GIT_SHA = /^[0-9a-f]{40}$/;

/**
 * Reduce a raw build-time value to a release identifier we will vouch for.
 *
 * ⚠️ ANYTHING THAT IS NOT A FULL 40-CHARACTER GIT SHA BECOMES `unknown`, AND
 * THE STRICTNESS IS THE POINT. A short SHA, a branch name or a tag would each
 * satisfy a naive equality against some other short SHA, branch or tag, and the
 * whole value of this check is that the comparison in deploy.yml is exact. An
 * identifier we cannot compare exactly is worse than no identifier, because it
 * reads as provenance while proving nothing.
 */
export function normaliseRelease(raw: string | undefined | null): string {
  if (!raw) return RELEASE_UNKNOWN;
  const trimmed = raw.trim().toLowerCase();
  return FULL_GIT_SHA.test(trimmed) ? trimmed : RELEASE_UNKNOWN;
}

/** The release this bundle was built from, or `unknown`. */
export function currentRelease(): string {
  return normaliseRelease(process.env.CAPUCOR_RELEASE);
}
