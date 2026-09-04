#!/usr/bin/env node
/**
 * Credential-free OpenNext/Cloudflare production build.
 *
 * ⚠️ Hand-synced with ../capucor-os/scripts/build-cf-offline.mjs, together with
 * scripts/offline-build-guards.mjs beside it. Both repositories build the same
 * way and both need the same credential boundary; a one-sided edit is exactly
 * the drift knownDuplicates exists for.
 *
 * WHY THIS EXISTS. `npm run build:cf` is a production-shaped build, and until
 * now it could only be proved in CI — because on the dev box it reads
 * `.env.local`, and the credential-restricted sandbox that does the engineering
 * work is not allowed to touch that file. The practical effect was that the
 * single most fragile step in this stack (OpenNext bundling a Next build into a
 * working worker — see docs/deploy.md) had no
 * local proof at all. A dependency bump, a `next.config.ts` edit or a new route
 * could only be discovered to break the bundle after it was pushed.
 *
 * This script closes that gap WITHOUT relaxing the credential boundary. It
 * builds a disposable snapshot of the repository that provably cannot contain
 * `.env.local`, hands `next build` clearly synthetic placeholder values, and
 * deletes the snapshot again.
 *
 * ⚠️ WHAT IT PROVES AND WHAT IT DOES NOT.
 *   IT PROVES: the current tree still compiles, bundles and packages into a
 *   Cloudflare worker — the build-compatibility half.
 *   IT DOES NOT PROVE: anything about production configuration, real secrets,
 *   Worker bindings, or live behaviour. The values baked into this build are
 *   deliberately fake, so the artefact it produces is NOT deployable and must
 *   never be deployed. `npm run build:cf` in CI, with real repository secrets,
 *   remains the only build that ships. See ADR 0003 and deploy.yml.
 *
 * HOW THE CREDENTIAL BOUNDARY IS ENFORCED. Three independent guards, because
 * one of them silently failing is exactly the shape of bug that matters here:
 *
 *   1. STRUCTURAL. The file set copied into the snapshot is whatever
 *      `git ls-files --cached --others --exclude-standard` reports — i.e.
 *      tracked files plus untracked files git does NOT ignore. Both repos
 *      ignore `.env*`, `.dev.vars*` and `*.pem`; capucor-os additionally
 *      ignores `*.key`, `backups/` and `e2e/.state/`, which it has and
 *      capucor-web does not.
 *      ⚠️ THE TWO `.gitignore` FILES DIFFER, so guard 1's strength differs
 *      between the repositories even though this script does not. That is
 *      precisely why guard 2 exists and is not merely belt-and-braces: it is
 *      the only layer that is identical in both.
 *   2. EXPLICIT. A deny-filter drops anything matching a dotenv or key/secret
 *      filename anyway, including `.env.example`, which git DOES track.
 *   3. ASSERTED. After the copy and again after the build, the snapshot is
 *      walked and the run FAILS if any dotenv-shaped file is present. A build
 *      that could have read one never gets to finish.
 *
 * The real `.env.local` is never read, copied, renamed, moved or stat-ed by
 * this script. It is not referenced by path anywhere in it.
 *
 * ⛔ BE PRECISE: THIS IS CONTAINMENT, NOT CONFINEMENT. The guards decide what
 * goes INTO the snapshot; they cannot stop a process that is already running as
 * you from opening an absolute path. `npm ci` executes install lifecycle
 * scripts for the whole dependency tree with your HOME and your filesystem
 * rights, exactly as it does at the repository root — this script neither adds
 * that exposure nor removes it. The real boundary is the OS-level sandbox the
 * agent runs under. Do NOT treat `build:cf:offline` as a sandbox and run
 * something inside it you would not run at the repo root.
 *
 * THE CHILD ENVIRONMENT IS SCRUBBED TOO. A shell that happens to have
 * SUPABASE_SERVICE_ROLE_KEY exported would otherwise leak straight past the
 * file-level guards, so every credential-shaped variable is deleted from the
 * child env before the synthetic placeholders are set.
 *
 *   npm run build:cf:offline            # build, then delete the snapshot
 *   node scripts/build-cf-offline.mjs --keep   # leave the snapshot to inspect
 *
 * It runs `npm ci` inside the snapshot, so it needs the npm registry (not a
 * credential) and takes minutes rather than seconds. See installDependencies()
 * for why linking the repository's node_modules instead does not work here.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

// The credential boundary itself lives next door so the unit suite can call it
// with adversarial inputs; importing THIS file would run a three-minute build.
import {
  SNAPSHOT_PREFIX,
  SYNTHETIC_ENV,
  filterSnapshotPaths,
  findDotenvFiles,
  removeSnapshot,
  scrubEnvironment,
} from './offline-build-guards.mjs';

const SOURCE_REPO_ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'));
const IS_WINDOWS = process.platform === 'win32';

const KEEP = process.argv.includes('--keep');

/** File types the post-build assertion reads. See the note in search(). */
const SEARCHABLE = /\.(?:m?js|cjs|json|html|txt)$/i;

/** The host the post-build assertion looks for in the client bundle. */
const SYNTHETIC_HOST = new URL(SYNTHETIC_ENV.NEXT_PUBLIC_SUPABASE_URL).host;

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exitCode = 1;
  throw new Error(message);
}

function log(message) {
  console.log(message);
}

/** Guard 1. Ask git which paths are part of the tree, ignoring ignored files. */
function trackedAndUntrackedPaths() {
  const stdout = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: SOURCE_REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return stdout.split('\0').filter(Boolean);
}

function copySnapshot(destination) {
  const paths = trackedAndUntrackedPaths();
  if (paths.length === 0) {
    fail('git listed no files to snapshot. Refusing to build an empty tree.');
  }

  // Guard 2, applied. See filterSnapshotPaths for why it is not inline.
  const { keep, excluded } = filterSnapshotPaths(paths);
  let copied = 0;

  let skipped = 0;

  for (const relativePath of keep) {
    const from = join(SOURCE_REPO_ROOT, relativePath);

    // `git ls-files --cached` still lists a file deleted from the working tree,
    // and it lists a submodule gitlink as a single entry. copyFileSync also
    // FOLLOWS symlinks, so anything that is not a regular file is skipped and
    // counted rather than copied — a silent drop here would be a hole in the
    // snapshot that nothing downstream could notice.
    const stats = statSync(from, { throwIfNoEntry: false });
    if (!stats?.isFile()) {
      skipped += 1;
      continue;
    }

    const to = join(destination, relativePath);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    copied += 1;
  }

  return { copied, excluded: excluded.length, skipped };
}

/** Guard 3. Walk the snapshot and refuse to continue if a dotenv file exists. */
function assertNoDotenvFiles(root, when) {
  const offenders = findDotenvFiles(root);

  if (offenders.length > 0) {
    fail(
      `A dotenv file reached the credential-free snapshot ${when}:\n` +
        offenders.map((f) => `    ${f}`).join('\n') +
        '\n  The offline build must not be able to read developer credentials.',
    );
  }

  log(`✓ No dotenv file in the snapshot (${when}).`);
}

/**
 * ⚠️ THE SNAPSHOT INSTALLS ITS OWN node_modules AND MUST NOT LINK TO THE
 * REPOSITORY'S — this was tried first and it does not work here.
 *
 * A junction (Windows) or directory symlink (POSIX) is the obvious way to skip
 * a multi-minute install, and it fails inside OpenNext rather than at the link:
 * `@opennextjs/aws`'s copyTracedFiles readlink()s every traced path and
 * faithfully RECREATES any symlink it finds (it is there for pnpm layouts). A
 * linked `node_modules` is itself a traced path, so the bundler tries to create
 * a directory symlink in the output — which needs Developer Mode or elevation
 * on Windows and dies with EPERM after the whole Next build has already run.
 * MEASURED 2026-09-04.
 *
 * A clean install is also the more honest check: CI runs `npm ci`, so this
 * proves the same thing CI proves, including that the lockfile still resolves.
 * The cost is the npm cache being warm, not a fresh download of everything.
 *
 * It also removes the sharpest hazard in this script. With no link in the
 * snapshot there is no path by which a recursive delete can walk out of the
 * temporary directory and into the repository's real node_modules.
 */
function installDependencies(snapshot, env) {
  log('\n→ npm ci (clean install inside the snapshot)\n');
  run('npm', ['ci'], snapshot, env);
}

/** Inherit the environment, then strip everything credential-shaped from it. */
function buildEnvironment() {
  const { env, stripped } = scrubEnvironment(process.env);

  // The synthetic NEXT_PUBLIC_SUPABASE_* keys match CREDENTIAL_ENV themselves,
  // so this asserts the ORDER inside scrubEnvironment (strip, THEN set) rather
  // than the filter. Reversed, the build would run with an empty Supabase URL.
  for (const [name, value] of Object.entries(SYNTHETIC_ENV)) {
    if (env[name] !== value) {
      fail(`Synthetic value for ${name} did not survive the env scrub.`);
    }
  }

  if (stripped.length > 0) {
    log(
      `✓ Stripped ${stripped.length} credential-shaped variable(s) from the build env: ${stripped.join(', ')}`,
    );
  } else {
    log('✓ No credential-shaped variables were present in the environment.');
  }

  return env;
}

function run(command, args, cwd, env) {
  execFileSync(IS_WINDOWS ? `${command}.cmd` : command, args, {
    cwd,
    env,
    stdio: 'inherit',
    // npm on Windows is a .cmd shim; execFileSync needs the shell to run it.
    shell: IS_WINDOWS,
  });
}

/**
 * Post-build proof that the build was actually driven by the synthetic values.
 *
 * This is the same assertion CI makes after the real build ("did the Supabase
 * URL reach the client bundle"), pointed at the placeholder. If it passes, the
 * build genuinely consumed the env this script supplied; if the script had
 * somehow picked up a different one, the placeholder host would be absent.
 */
function assertSyntheticValuesReachedTheBundle(root) {
  const worker = join(root, '.open-next', 'worker.js');
  if (!existsSync(worker)) {
    fail('The build produced no .open-next/worker.js — the Cloudflare bundle did not complete.');
  }
  log('✓ .open-next/worker.js exists.');

  // Searched in-process rather than by shelling out to grep: this script has to
  // run from PowerShell as well as from a POSIX shell, and a missing grep would
  // turn the assertion into a crash rather than a verdict.
  const search = (directory) => {
    const found = [];
    if (!existsSync(directory)) return found;
    const walk = (current) => {
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const full = join(current, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && SEARCHABLE.test(entry.name)) {
          // Bounded to emitted JavaScript on purpose. The traced tree contains
          // native binaries and wasm; reading all of it as UTF-8 is minutes of
          // I/O per run, and one unreadable file would become a reported build
          // failure. The values we look for are inlined literals, so they can
          // only be in code.
          if (readFileSync(full, 'utf8').includes(SYNTHETIC_HOST)) found.push(full);
        }
      }
    };
    walk(directory);
    return found;
  };

  // The server bundle ALWAYS carries it: next.config.ts puts the Supabase URL
  // into the CSP `connect-src`, and that header is baked at build time. This is
  // the half that holds in both repositories.
  const inServer = search(join(root, '.open-next', 'server-functions'));
  if (inServer.length === 0) {
    fail(
      `The synthetic Supabase host ${SYNTHETIC_HOST} is nowhere in the server ` +
        'bundle, so this build did not consume the environment this script ' +
        'supplied. Treat the result as unproven.',
    );
  }
  log(`✓ Synthetic Supabase host reached ${inServer.length} server file(s) — the build used our env.`);

  // SELF-ARMING, and for exactly the reason capucor-web's deploy.yml gives for
  // NOT grepping the client bundle there: the client inlining only happens when
  // a BROWSER Supabase client exists to inline it for. capucor-os has one
  // (/login); capucor-web does not — that went to capucor-os in Phase 3 — so a
  // hardcoded client-asset assertion would fail 100% of the time in one repo
  // while proving something real in the other. Checking for the file arms the
  // gate where it means something and stays quiet where it does not, so the two
  // copies of this script stay identical. MEASURED 2026-09-04: without this,
  // capucor-web's first credential-free build failed on precisely that.
  if (!existsSync(join(root, 'src', 'lib', 'supabase', 'client.ts'))) {
    log('ℹ No src/lib/supabase/client.ts, so there is no browser Supabase client');
    log('  to inline the URL into. Skipping the client-bundle half — it arms');
    log('  itself if this repository ever gains one.');
    return;
  }

  const inClient = search(join(root, '.open-next', 'assets', '_next', 'static'));
  if (inClient.length === 0) {
    fail(
      `This repository HAS a browser Supabase client, but ${SYNTHETIC_HOST} was ` +
        'not inlined into the client bundle. On a real build that is a broken ' +
        'login page; here it means the build did not consume our environment.',
    );
  }
  log(`✓ Synthetic Supabase host inlined into ${inClient.length} client asset(s).`);
}

function main() {
  // Derived, not written: this file is a code-mode knownDuplicates pair, so a
  // repo-specific literal here would either break the equality or announce the
  // wrong repository. It did the latter.
  log(`${basename(SOURCE_REPO_ROOT)} — credential-free Cloudflare build`);
  log(`Repository: ${SOURCE_REPO_ROOT}`);
  log('');

  const root = mkdtempSync(join(tmpdir(), SNAPSHOT_PREFIX));
  // Named after the repository it snapshots, not hardcoded: this script is
  // byte-shared with capucor-web, and a snapshot of one repo sitting in a
  // directory named after the other is a confusing thing to find in a log.
  const snapshot = join(root, basename(SOURCE_REPO_ROOT));

  try {
    mkdirSync(snapshot, { recursive: true });

    const { copied, excluded, skipped } = copySnapshot(snapshot);
    log(`✓ Snapshotted ${copied} file(s) into ${snapshot}`);
    log(`✓ Excluded ${excluded} credential-shaped path(s) by name.`);
    if (skipped > 0) {
      log(`ℹ Skipped ${skipped} path(s) that are not regular files (symlink, gitlink, deleted).`);
    }

    assertNoDotenvFiles(snapshot, 'before the build');

    const env = buildEnvironment();

    installDependencies(snapshot, env);

    log('\n→ npm run build:cf (inside the snapshot)\n');
    run('npm', ['run', 'build:cf'], snapshot, env);

    log('');
    assertNoDotenvFiles(snapshot, 'after the build');
    assertSyntheticValuesReachedTheBundle(snapshot);

    log('');
    log('✓ Credential-free Cloudflare build succeeded.');
    log('  This proves BUILD COMPATIBILITY only. It says nothing about');
    log('  production configuration, real secrets or live behaviour, and the');
    log('  artefact is built from placeholder values — never deploy it.');
  } finally {
    if (KEEP) {
      log('');
      // `root`, not `snapshot` — the mkdtemp PARENT is what is left on disk,
      // and naming the child sent people to delete one level too deep.
      log(`--keep: snapshot left at ${root}`);
      log('  It contains no credentials by construction, but delete it when done.');
    } else {
      // ⚠️ CLEANUP MUST NOT CHANGE THE VERDICT, IN EITHER DIRECTION.
      //
      // This deletes a node_modules tree written seconds earlier by npm ci and
      // esbuild, and EPERM/EBUSY/ENOTEMPTY there is routine on Windows. Left
      // to throw, it escaped main() and the top-level catch reported
      // "Offline Cloudflare build failed" for a build that had SUCCEEDED —
      // in the one lane whose whole value is being a trustworthy local
      // verdict. It would equally have replaced a real build error with a
      // filesystem one.
      //
      // So: retry, then warn and name the leftover path. A snapshot left in
      // temp is an annoyance; a wrong verdict is the thing this script exists
      // to avoid.
      try {
        removeSnapshot(root, (target) =>
          rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }),
        );
        log('');
        log('✓ Snapshot removed.');
      } catch (error) {
        log('');
        log(`⚠ Could not remove the snapshot at ${root}: ${error.message}`);
        log('  It holds repository source and no credentials. Delete it by hand.');
        log('  This did NOT affect the build result reported above.');
      }
    }
  }
}

try {
  main();
} catch (error) {
  if (process.exitCode !== 1) {
    console.error(`\n✗ Offline Cloudflare build failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
