/**
 * The credential boundary of the offline Cloudflare build, on its own.
 *
 * ⚠️ Hand-synced with ../capucor-os/scripts/offline-build-guards.mjs.
 *
 * WHY IT IS A SEPARATE MODULE. `scripts/build-cf-offline.mjs` runs a build the
 * moment it is imported, so a unit test cannot import it to check its rules —
 * it would spend three minutes running a webpack build instead. Everything that
 * DECIDES what may cross into the disposable snapshot lives here, where the
 * suite can call it directly with adversarial inputs and watch it refuse them.
 *
 * That distinction matters more than it looks. Every guard in this file is a
 * NEGATIVE control: it is correct exactly when nothing happens. A regex that
 * quietly stopped matching `.env.local` would look identical to a working one
 * from the outside, on every run, until the day it mattered — which is the same
 * shape of failure a CRLF-normalising source reader exists to prevent.
 *
 * See `scripts/build-cf-offline.mjs` for how the three guards fit together.
 */

import { readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

/**
 * Guard 2 — filenames that must never reach the snapshot, even when git tracks
 * them (guard 1 already drops everything `.gitignore` covers).
 *
 * `.env.example` matches ON PURPOSE. The build has no use for it, and excluding
 * EVERY dotenv-shaped file lets guard 3 assert something unconditional — "no
 * dotenv file exists in this snapshot" — instead of maintaining a list of
 * sanctioned exceptions, which is the kind of list that grows one careless
 * entry at a time.
 *
 * `.envrc` is here because direnv files routinely hold exported secrets, and
 * the `.env`-prefixed pattern below does not reach it.
 *
 * ⚠️ `.npmrc` is excluded too, which means a project-level registry
 * configuration would NOT reach the snapshot's `npm ci`. There is none in this
 * repository today. If one is ever added, this is the line that has to change,
 * and the exclusion count the build prints is what will point at it.
 */
export const SECRET_FILE =
  /^(?:\.env(?:$|\.)|\.envrc$|\.dev\.vars|\.npmrc$)|\.(?:key|pem)$/i;

/**
 * Guard 3's detector — deliberately NARROWER than SECRET_FILE.
 *
 * This one is the assertion that stops the build, so it describes the single
 * condition that would make the build unsound (a dotenv file `next build` would
 * load), not the wider hygiene rule. Keeping them separate means tightening
 * hygiene can never accidentally weaken the assertion, or vice versa.
 */
export const DOTENV_FILE = /^\.env(?:$|\.)|^\.envrc$/i;

/**
 * Environment variable names to strip from the child process.
 *
 * A pattern rather than a list, because the variable that leaks is the one
 * nobody thought to enumerate. It is deliberately over-broad: a false positive
 * costs a build-time value the offline build does not need, while a false
 * negative hands a live credential to a process this whole script exists to
 * keep away from one.
 */
export const CREDENTIAL_ENV =
  /(?:SUPABASE|RESEND|CLOUDFLARE|WRANGLER|PAYFAST|XERO|KARBON|SIMPLEPAY|APPS_SCRIPT|SECRET|TOKEN|PASSWORD|CREDENTIAL|PRIVATE_KEY|API_KEY)/i;

/**
 * The synthetic build-time values handed to `next build`.
 *
 * Every host is under `.invalid`, which RFC 2606 reserves and guarantees will
 * never resolve, so a bundle built here cannot reach a real service even if it
 * were deployed by mistake. They are also unmistakable on sight: an operator
 * who finds `offline-build-placeholder` in a deployed artefact knows instantly
 * what happened.
 *
 * NEXT_PUBLIC_SUPABASE_URL is the load-bearing one. `next.config.ts` puts it in
 * the CSP `connect-src` and `next build` inlines it into the client bundle, and
 * that config THROWS when `CI` is set and the URL is empty. Setting `CI` here
 * therefore exercises that guard rather than routing around it — and the
 * post-build assertion looks for this exact host in the client assets, which is
 * what proves the build consumed THIS environment and not some other one.
 */
export const SYNTHETIC_ENV = Object.freeze({
  CI: '1',
  NEXT_PUBLIC_SUPABASE_URL: 'https://offline-build-placeholder.supabase.invalid',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'offline-build-placeholder-anon-key',
  NEXT_PUBLIC_APP_URL: 'https://offline-build-placeholder.invalid',
  NEXT_PUBLIC_BOOKING_URL: 'https://offline-build-placeholder.invalid/book',
});

/** Prefix of every disposable snapshot directory. Also the delete guard. */
export const SNAPSHOT_PREFIX = 'capucor-cf-offline-';

/** True when ANY segment of a repo-relative path is a credential-shaped name. */
export function isSecretPath(relativePath) {
  return relativePath.split(/[\\/]/).some((segment) => SECRET_FILE.test(segment));
}

/**
 * Guard 2 as an APPLIED FILTER, not just a predicate.
 *
 * ⚠️ IT LIVES HERE RATHER THAN INLINE IN THE COPY LOOP SO IT CAN BE TESTED.
 * With the filtering inline, deleting one `continue` left every test passing
 * while credential-shaped files were copied into the snapshot — guard 3 would
 * still have caught a dotenv file, but NOT `*.key`, `*.pem`, `.dev.vars` or
 * `.npmrc`, which are deliberately in SECRET_FILE and deliberately not in
 * DOTENV_FILE. The gap between those two lists is exactly what this function
 * protects, so it is the thing that has to be exercised.
 */
export function filterSnapshotPaths(paths) {
  const keep = [];
  const excluded = [];
  for (const path of paths) {
    (isSecretPath(path) ? excluded : keep).push(path);
  }
  return { keep, excluded };
}

/**
 * Refuse to recursively delete anything this script did not create.
 *
 * ⚠️ THE MOST DESTRUCTIVE OPERATION IN THE OFFLINE BUILD, so it is a function
 * the suite can call with a hostile argument rather than a line the suite can
 * only read. `rmSync({ recursive: true })` uses lstat semantics — it unlinks a
 * symlink rather than recursing through it — and the build deliberately creates
 * none, but the prefix check is what stops a future edit pointing this at a
 * path that is not a snapshot at all.
 */
export function removeSnapshot(root, remove) {
  if (!basename(root).startsWith(SNAPSHOT_PREFIX)) {
    throw new Error(`Refusing to delete ${root}: not a ${SNAPSHOT_PREFIX}* snapshot.`);
  }
  remove(root);
}

/** True when a bare filename is one `next build` would load as environment. */
export function isDotenvFile(name) {
  return DOTENV_FILE.test(name);
}

/**
 * Guard 3 itself — walk a snapshot and return every dotenv-shaped file in it.
 *
 * Returns rather than throws so the caller decides what a hit means, and so the
 * suite can point it at a fixture that DOES contain `.env.local` and watch it
 * come back non-empty. A guard that has only ever been run over a clean tree is
 * a function that returns `[]`.
 *
 * `node_modules` is skipped: the installed tree is not part of the credential
 * question, packages legitimately ship `.env`-named fixtures, and walking it
 * would add tens of thousands of stats to every build. Symlinks are not
 * followed, so a link cannot walk the check out of the snapshot.
 */
export function findDotenvFiles(root) {
  const offenders = [];

  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(join(directory, entry.name));
        continue;
      }
      if (isDotenvFile(entry.name)) offenders.push(join(directory, entry.name));
    }
  };

  walk(root);
  return offenders;
}

/**
 * Build the child environment: inherit, strip every credential-shaped name,
 * THEN apply the synthetic values.
 *
 * ⚠️ THE ORDER IS LOAD-BEARING AND NOT INCIDENTAL. `NEXT_PUBLIC_SUPABASE_URL`
 * and `NEXT_PUBLIC_SUPABASE_ANON_KEY` both match CREDENTIAL_ENV, so scrubbing
 * after assigning would delete the placeholders and hand `next build` an empty
 * Supabase URL — which `next.config.ts` turns into a hard failure under `CI`,
 * but only because that guard happens to exist. The returned object is checked
 * against SYNTHETIC_ENV by the caller so the ordering is asserted rather than
 * assumed.
 */
export function scrubEnvironment(source) {
  const env = { ...source };
  const stripped = [];

  for (const name of Object.keys(env)) {
    if (CREDENTIAL_ENV.test(name)) {
      delete env[name];
      stripped.push(name);
    }
  }

  Object.assign(env, SYNTHETIC_ENV);

  return { env, stripped: stripped.sort() };
}
