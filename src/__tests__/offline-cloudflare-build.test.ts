/**
 * The credential boundary of `npm run build:cf:offline`.
 *
 * ⚠️ EVERY ASSERTION HERE IS A NEGATIVE CONTROL, WHICH IS WHY THEY ARE WRITTEN
 * AGAINST BEHAVIOUR RATHER THAN AGAINST THE SOURCE TEXT WHEREVER POSSIBLE.
 * "The build did not read `.env.local`" looks identical whether the guard is
 * working or the guard is gone, on every run, forever — until the run where it
 * mattered. So the exclusion rules are imported and called with the real names
 * they exist to refuse, and the environment scrub is handed an environment that
 * actually contains a service-role key.
 *
 * The source-level tripwires at the end cover the parts that cannot be called
 * without running a three-minute webpack build: that the script derives its
 * file set from git rather than from a hand-written list, that it asserts
 * before AND after the build, and that its cleanup cannot be pointed at a
 * directory it did not create.
 *
 * ⚠️ Hand-synced with
 * ../capucor-os/src/__tests__/offline-cloudflare-build.test.ts. Both repositories
 * build the same way and carry the same credential boundary.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  CREDENTIAL_ENV,
  SYNTHETIC_ENV,
  findDotenvFiles,
  isDotenvFile,
  SNAPSHOT_PREFIX,
  filterSnapshotPaths,
  isSecretPath,
  removeSnapshot,
  scrubEnvironment,
} from '../../scripts/offline-build-guards.mjs';
import { readFileSync as read } from 'node:fs';

/**
 * Read a repository file with line endings normalised to LF.
 *
 * ⚠️ core.autocrlf is true on the Windows development box, so .ts and .json are
 * CRLF on disk while the committed blob is LF. A needle containing a newline
 * matches nothing on such a checkout — and a NEGATIVE assertion that matches
 * nothing passes vacuously, which is indistinguishable from a working guard
 * until the day it is needed. Every assertion in this file is a negative
 * control, so this is not a nicety.
 */
function readSource(...parts: string[]): string {
  return read(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
}

const script = readSource('scripts', 'build-cf-offline.mjs');
const guards = readSource('scripts', 'offline-build-guards.mjs');
const packageJson = JSON.parse(readSource('package.json')) as {
  scripts: Record<string, string>;
};

/**
 * The script WITHOUT its comments.
 *
 * The negative assertions below have to be made against code, not prose. This
 * script's header explains at length why it must not link `node_modules` and
 * why it never touches `.env.local` — so a `not.toContain('junction')` run over
 * the raw text fails on the very comment that documents the rule, and the
 * obvious "fix" is to delete the explanation. Same rule the cross-repo audit
 * uses for its `code` pair mode.
 */
const scriptCode = script
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((line) => !/^\s*\/\//.test(line))
  .join('\n');

/**
 * ⚠️ AND THE STRIPPED VIEW MUST STILL CONTAIN CODE.
 *
 * Several negative assertions below read `scriptCode`. The block-comment regex
 * is non-greedy and unanchored, so a `/*` inside a string or regex literal in
 * the script would swallow the rest of the file — and every one of those
 * negatives would pass, silently and together, against an empty string. This is
 * the anchor that keeps them meaning something.
 */
if (!scriptCode.includes("run('npm', ['ci'], snapshot, env)")) {
  throw new Error(
    'Comment stripping collapsed the script: the known code line is gone, so ' +
      'every negative assertion in this file would now pass vacuously.',
  );
}

describe('offline Cloudflare build — file exclusion', () => {
  it('1. refuses every dotenv-shaped file, including the tracked example', () => {
    // .env.local is THE file this whole script exists to stay away from.
    expect(isSecretPath('.env.local')).toBe(true);
    expect(isSecretPath('.env')).toBe(true);
    expect(isSecretPath('.env.production')).toBe(true);
    expect(isSecretPath('.env.production.local')).toBe(true);
    // Tracked by git (`!.env.example` in .gitignore), so guard 1 would let it
    // through. Excluding it is what makes the post-copy assertion absolute.
    expect(isSecretPath('.env.example')).toBe(true);
    // direnv: not matched by an `.env`-prefix rule, and routinely holds exports.
    expect(isSecretPath('.envrc')).toBe(true);
  });

  it('2. refuses Wrangler dev vars, key material and registry config', () => {
    expect(isSecretPath('.dev.vars')).toBe(true);
    expect(isSecretPath('.dev.vars.production')).toBe(true);
    expect(isSecretPath('service-account.key')).toBe(true);
    expect(isSecretPath('certs/private.pem')).toBe(true);
    expect(isSecretPath('.npmrc')).toBe(true);
  });

  it('3. catches a credential file at ANY depth, on either path separator', () => {
    expect(isSecretPath('e2e/.env.local')).toBe(true);
    expect(isSecretPath('supabase/functions/.env')).toBe(true);
    // git reports forward slashes, but the same predicate guards Windows paths.
    expect(isSecretPath('e2e\\.env.local')).toBe(true);
  });

  it('4. does NOT refuse ordinary source that merely reads like a secret', () => {
    // A guard that swallows real source is a guard someone loosens under
    // deadline, so the false-positive edge is pinned as tightly as the true one.
    expect(isSecretPath('src/lib/env.ts')).toBe(false);
    expect(isSecretPath('src/__tests__/env.test.ts')).toBe(false);
    expect(isSecretPath('src/lib/environment/index.ts')).toBe(false);
    expect(isSecretPath('scripts/build-cf-offline.mjs')).toBe(false);
    expect(isSecretPath('docs/keys.md')).toBe(false);
    expect(isSecretPath('public/monkey.png')).toBe(false);
  });

  it('5. the post-copy assertion detects the file the copy filter is meant to drop', () => {
    // Guards 2 and 3 are independent on purpose: this is the one that STOPS the
    // build, so it has to recognise the file even if the copy filter regressed.
    expect(isDotenvFile('.env.local')).toBe(true);
    expect(isDotenvFile('.env')).toBe(true);
    expect(isDotenvFile('.envrc')).toBe(true);
    expect(isDotenvFile('package.json')).toBe(false);
    expect(isDotenvFile('env.ts')).toBe(false);
  });
});

describe('offline Cloudflare build — the snapshot assertion, on a real tree', () => {
  const fixtures: string[] = [];

  function fixture(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'capucor-offline-guard-fixture-'));
    fixtures.push(root);
    for (const [relative, contents] of Object.entries(files)) {
      const full = join(root, relative);
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, contents);
    }
    return root;
  }

  afterAll(() => {
    for (const root of fixtures) rmSync(root, { recursive: true, force: true });
  });

  it('5a. FINDS a planted .env.local — the guard bites', () => {
    // The whole suite is otherwise negative controls. This one plants the
    // exact file the build must never see and proves the walker returns it,
    // so a regression that made findDotenvFiles always return [] cannot pass.
    const root = fixture({
      'package.json': '{}',
      '.env.local': 'SUPABASE_SERVICE_ROLE_KEY=leaked',
      'src/app/page.tsx': 'export default function Page() {}',
    });

    const offenders = findDotenvFiles(root);

    expect(offenders).toHaveLength(1);
    expect(offenders[0]).toBe(join(root, '.env.local'));
  });

  it('5b. finds one nested several directories deep', () => {
    const root = fixture({
      'package.json': '{}',
      'e2e/config/.env.production': 'RESEND_API_KEY=leaked',
    });

    expect(findDotenvFiles(root)).toEqual([join(root, 'e2e', 'config', '.env.production')]);
  });

  it('5c. returns nothing for the tree the copy filter actually produces', () => {
    // The passing case has to be real too, or the assertion above proves only
    // that the walker can find something, not that it stays quiet correctly.
    const root = fixture({
      'package.json': '{}',
      'src/lib/env.ts': 'export const RUNTIME_VARS = [];',
      'docs/environment.md': '# environment',
    });

    expect(findDotenvFiles(root)).toEqual([]);
  });

  it('5d. does not walk node_modules, where packages ship .env fixtures', () => {
    const root = fixture({
      'package.json': '{}',
      'node_modules/some-package/test/.env': 'FIXTURE=1',
    });

    expect(findDotenvFiles(root)).toEqual([]);
  });
});

describe('offline Cloudflare build — environment scrub', () => {
  it('6. strips a live service-role key out of the build environment', () => {
    const { env, stripped } = scrubEnvironment({
      PATH: '/usr/bin',
      SUPABASE_SERVICE_ROLE_KEY: 'a-real-looking-service-role-key',
      RESEND_API_KEY: 're_live_value',
      CLOUDFLARE_API_TOKEN: 'cf-token',
      SUPABASE_ACCESS_TOKEN: 'sbp_token',
      GITHUB_TOKEN: 'ghp_token',
    });

    for (const name of [
      'SUPABASE_SERVICE_ROLE_KEY',
      'RESEND_API_KEY',
      'CLOUDFLARE_API_TOKEN',
      'SUPABASE_ACCESS_TOKEN',
      'GITHUB_TOKEN',
    ]) {
      expect(stripped).toContain(name);
      expect(env[name]).toBeUndefined();
    }

    // No value survives anywhere in the environment, not merely under its key.
    const serialised = JSON.stringify(env);
    expect(serialised).not.toContain('a-real-looking-service-role-key');
    expect(serialised).not.toContain('re_live_value');
    expect(serialised).not.toContain('cf-token');

    // ...while the environment a build actually needs is left alone.
    expect(env.PATH).toBe('/usr/bin');
  });

  it('7. applies the synthetic values AFTER the scrub, not before', () => {
    // The ordering bug this pins is silent: NEXT_PUBLIC_SUPABASE_URL matches
    // CREDENTIAL_ENV, so scrubbing last would delete the placeholder and hand
    // `next build` an empty Supabase URL.
    expect(CREDENTIAL_ENV.test('NEXT_PUBLIC_SUPABASE_URL')).toBe(true);
    expect(CREDENTIAL_ENV.test('NEXT_PUBLIC_SUPABASE_ANON_KEY')).toBe(true);

    const { env } = scrubEnvironment({ NEXT_PUBLIC_SUPABASE_URL: 'https://real.supabase.co' });

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe(SYNTHETIC_ENV.NEXT_PUBLIC_SUPABASE_URL);
    expect(env.NEXT_PUBLIC_SUPABASE_URL).not.toContain('real.supabase.co');
  });

  it('8. every synthetic value is unmistakably fake and cannot resolve', () => {
    for (const [name, value] of Object.entries(SYNTHETIC_ENV)) {
      // CI is a flag, and CAPUCOR_RELEASE has to LOOK like a real SHA for the
      // build's DefinePlugin to be exercised the way production exercises it —
      // so neither can carry the placeholder marker. 8a covers the release.
      if (name === 'CI' || name === 'CAPUCOR_RELEASE') continue;
      expect(value).toContain('offline-build-placeholder');
      if (value.startsWith('https://')) {
        // RFC 2606 reserves .invalid — a bundle built here cannot reach a real
        // service even if somebody deployed it by mistake.
        expect(new URL(value).host.endsWith('.invalid')).toBe(true);
      }
    }
  });

  it('8a. the synthetic release is a well-formed SHA that is obviously not a commit', () => {
    // It must satisfy lib/release.ts's 40-hex rule, or the build would bake
    // 'unknown' and the injection would go unexercised — which is the bug this
    // value was added to close. It must equally never be mistaken for a real
    // commit, so it spells out what it is.
    expect(SYNTHETIC_ENV.CAPUCOR_RELEASE).toMatch(/^[0-9a-f]{40}$/);
    expect(SYNTHETIC_ENV.CAPUCOR_RELEASE).toContain('0ff11e0ff11e');
  });

  it('9. sets CI, so next.config.ts enforces its own empty-URL guard', () => {
    // Without CI the guard is inert, and an offline build that silently lost
    // its Supabase URL would go green.
    //
    // ⚠️ THIS ASSERTION WAS WRITTEN INVERTED FIRST, and the mistake is worth
    // recording because it is the shape a copied test fails in. It claimed this
    // repo had "no equivalent guard to arm" and pinned
    // `not.toContain('PHASE_PRODUCTION_BUILD')` — which goes RED if this repo
    // ever gains capucor-os's phase gate (an improvement) and stays GREEN if
    // someone deletes the guard entirely (the regression it was meant to
    // catch). It also asserted something untrue: the guard is right there in
    // next.config.ts and predates this change.
    expect(SYNTHETIC_ENV.CI).toBe('1');
    expect(readSource('next.config.ts')).toContain('process.env.CI && !SUPABASE_URL');
  });

  it('9a. pins WHERE that guard fires, because it differs from capucor-os', () => {
    // ⚠️ A REAL DIFFERENCE, PINNED SO IT STAYS A DECISION RATHER THAN A DRIFT.
    // capucor-os wraps the same throw in `phase === PHASE_PRODUCTION_BUILD`
    // precisely so unrelated CI importers — Vitest among them — do not need
    // deployment secrets. This repo throws on ANY import under CI, and
    // redirects.test.ts imports next.config directly, so this suite depends on
    // NEXT_PUBLIC_SUPABASE_URL being set in CI (ci.yml supplies it).
    //
    // That sits awkwardly beside the credential-independence reasoning in
    // vitest.config.ts, so it is a candidate for alignment — but changing when
    // a build-time guard fires is a behaviour change, not a test fix, and it is
    // outside AE-03's scope. Pinned here so the next reader finds the fact
    // instead of rediscovering it.
    const config = readSource('next.config.ts');
    expect(config).toContain('process.env.CI && !SUPABASE_URL');
    expect(config).not.toContain('PHASE_PRODUCTION_BUILD');
    expect(readSource('src', '__tests__', 'redirects.test.ts')).toContain(
      "import nextConfig from '../../next.config'",
    );
  });

  it('9b. guards vitest.config.ts, which carries the same credential boundary', () => {
    // AE-01 gave capucor-os `envDir: false` and a regression test; this repo got
    // the setting in AE-03 and, until now, nothing asserting it. Deleting the
    // line silently restores Vite's .env.local discovery during unit tests —
    // exactly the boundary crossing the setting exists to close, and a deletion
    // that no check would notice.
    expect(readSource('vitest.config.ts')).toMatch(/defineConfig\(\{[\s\S]*?envDir:\s*false,/);
  });
});

describe('offline Cloudflare build — the script itself', () => {
  it('10. is wired up as build:cf:offline and leaves build:cf untouched', () => {
    expect(packageJson.scripts['build:cf:offline']).toBe('node scripts/build-cf-offline.mjs');
    // The production build and deploy paths must be exactly as they were.
    expect(packageJson.scripts['build:cf']).toBe('opennextjs-cloudflare build');
    expect(packageJson.scripts['deploy:cf']).toBe(
      'opennextjs-cloudflare build && opennextjs-cloudflare deploy',
    );
  });

  it('11. derives its file set from git rather than a hand-maintained list', () => {
    // This is guard 1, and it is the reason `.env.local` cannot be reached even
    // if the deny-filter regressed: .gitignore already excludes it.
    expect(script).toContain("['ls-files', '-z', '--cached', '--others', '--exclude-standard']");
    expect(script).toContain('filterSnapshotPaths(paths)');
  });

  it('12. never names the real credential file', () => {
    // The acceptance criterion is not just "does not read it" — the script must
    // not copy, rename, chmod or stat it either, and the simplest durable proof
    // is that no path to it appears in the source at all.
    expect(scriptCode).not.toContain('.env.local');
    expect(scriptCode).not.toContain('chmodSync');
    expect(scriptCode).not.toContain('renameSync');
  });

  it('13. asserts the boundary both before and after the build', () => {
    expect(script).toContain("assertNoDotenvFiles(snapshot, 'before the build')");
    expect(script).toContain("assertNoDotenvFiles(snapshot, 'after the build')");
    // A dotenv file found at either point stops the run rather than warning.
    expect(script).toContain('A dotenv file reached the credential-free snapshot');
  });

  it('14. proves the build consumed the synthetic environment', () => {
    // Without this the script could pass while silently building from some
    // other env — the failure mode it exists to rule out. The SERVER half holds
    // in both repositories, because next.config.ts bakes the Supabase URL into
    // the CSP; the client half is self-arming, because only capucor-os has a
    // browser Supabase client to inline it for.
    expect(script).toContain('assertSyntheticValuesReachedTheBundle(snapshot)');
    expect(script).toContain("search(join(root, '.open-next', 'server-functions'))");
    expect(script).toContain('is nowhere in the server');
    expect(script).toContain("join(root, 'src', 'lib', 'supabase', 'client.ts')");
  });

  it('14a. correctly SKIPS the client-bundle half, because this repo has no browser client', () => {
    // ⚠️ THE MIRROR IMAGE OF THE capucor-os ASSERTION, AND A MEASURED FACT
    // RATHER THAN AN ASSUMPTION. The browser Supabase client went to capucor-os
    // with /login in Phase 3, so nothing here inlines the URL into the client
    // bundle — capucor-web's deploy.yml says the same thing about its own
    // removed grep. A hardcoded client-asset assertion fails 100% of the time
    // here, which is exactly what the first credential-free build did on
    // 2026-09-04 before the gate was made self-arming.
    expect(existsSync(join(process.cwd(), 'src', 'lib', 'supabase', 'client.ts'))).toBe(false);
    expect(script).toContain('arms');
  });

  it('15. cleans up on failure as well as success, and only its own snapshot', () => {
    // The cleanup lives in a `finally`, so a failed build still removes the
    // workspace. The behaviour of the prefix guard itself is driven in 15a.
    expect(script).toMatch(/\}\s*finally\s*\{[\s\S]*removeSnapshot\(root/);
    // The refusal message itself now lives in the guards module, where 15a can
    // drive it with a hostile path. Re-reading the string here would add nothing.
    expect(guards).toContain('Refusing to delete');
  });

  it('15a. REFUSES to delete a directory it did not create', () => {
    // ⚠️ THE MOST DESTRUCTIVE OPERATION IN THIS CHANGE, so it is driven with a
    // hostile argument rather than matched as a string. It was previously
    // proven only by `toContain` on its own source, which is the assertion
    // shape that cannot tell a working guard from a deleted one.
    const deleted: string[] = [];
    const remove = (target: string) => deleted.push(target);

    for (const hostile of [
      '/',
      'C:\\',
      join(tmpdir(), 'not-ours'),
      join(tmpdir(), 'capucor-audit-drill-abc'),
      process.cwd(),
    ]) {
      expect(() => removeSnapshot(hostile, remove)).toThrow(/Refusing to delete/);
    }

    // Nothing was handed to the remover on any of those paths.
    expect(deleted).toEqual([]);
  });

  it('15b. DOES delete a directory it did create — the guard is not simply always-throw', () => {
    // The paired positive. Without it, a guard that refused everything would
    // pass 15a while breaking cleanup entirely.
    const deleted: string[] = [];
    const own = join(tmpdir(), `${SNAPSHOT_PREFIX}abc123`);

    removeSnapshot(own, (target: string) => deleted.push(target));

    expect(deleted).toEqual([own]);
  });

  it('15c. the copy filter DROPS credential-shaped paths, not just recognises them', () => {
    // Guard 2 was proven as a predicate and never as an applied filter. Remove
    // the exclusion from the copy loop and every other test still passed —
    // guard 3 would catch a dotenv file, but NOT .key, .pem, .dev.vars or
    // .npmrc, which are deliberately in SECRET_FILE and not in DOTENV_FILE.
    const { keep, excluded } = filterSnapshotPaths([
      'package.json',
      '.env.local',
      '.env.example',
      'src/lib/env.ts',
      'certs/private.pem',
      'service-account.key',
      '.dev.vars',
      '.npmrc',
      'docs/keys.md',
    ]);

    expect(excluded.sort()).toEqual([
      '.dev.vars',
      '.env.example',
      '.env.local',
      '.npmrc',
      'certs/private.pem',
      'service-account.key',
    ]);
    expect(keep.sort()).toEqual(['docs/keys.md', 'package.json', 'src/lib/env.ts']);

    // Every input is accounted for: nothing is silently lost by the filter.
    expect(keep.length + excluded.length).toBe(9);
  });

  it('15d. cleanup cannot turn a SUCCESSFUL build into a reported failure', () => {
    // MEASURED CLASS OF BUG. rmSync over a node_modules tree written seconds
    // earlier by npm ci raises EPERM/EBUSY routinely on Windows. Thrown from
    // the `finally`, it escaped main() and the top-level catch reported
    // "Offline Cloudflare build failed" for a build that had SUCCEEDED — the
    // worst possible failure for a lane whose only job is a trustworthy local
    // verdict. It would equally have replaced a real build error with a
    // filesystem one.
    expect(scriptCode).toContain('maxRetries: 5');
    expect(script).toContain('This did NOT affect the build result reported above.');
    expect(scriptCode).toMatch(/catch \(error\) \{[\s\S]*Could not remove the snapshot/);
  });

  it('16. installs its own dependencies instead of linking the repository tree', () => {
    // A linked node_modules is both an OpenNext failure (it recreates traced
    // symlinks, which needs elevation on Windows) and the only path by which a
    // recursive delete could escape the temp directory. Neither may come back.
    expect(script).toContain("run('npm', ['ci'], snapshot, env)");
    expect(scriptCode).not.toContain('symlinkSync');
    expect(scriptCode).not.toContain('junction');
  });
});
