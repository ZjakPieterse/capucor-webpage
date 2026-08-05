/**
 * The CI-runnable subset of the cross-repo audit — capucor-web's half.
 *
 * WHY A SUBSET. The full audit lives in `capucor-os` (`npm run audit`) and needs
 * all three repos checked out side by side. CI checks out ONE, so everything
 * here is a question this repo can answer alone: does capucor-web still hold up
 * its half of the contract?
 *
 * The half it cannot answer — "and does capucor-os hold up the other half?" —
 * is covered by the digests. A hand-synced file that changes here moves its
 * digest, this test goes red, and the message names the counterpart that has to
 * change too. That is what turns "somebody should have noticed" into a failing
 * build, which is the whole point of PH-10.
 *
 * The contract lives in contracts/cross-repo-contract.json, vendored
 * byte-identical from capucor-docs. The full audit compares the three copies;
 * nothing here can, and that gap is stated rather than papered over.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { loadContract, digestFile } from '../../contracts/contract.mjs';

const ROOT = process.cwd();
const contract = loadContract(join(ROOT, 'contracts'));
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

describe('coupled dependencies', () => {
  const pkg = JSON.parse(read('package.json'));
  const installed: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };

  for (const [name, want] of Object.entries(contract.coupledDependencies.exact)) {
    it(`pins ${name} to exactly ${want}`, () => {
      // A caret here is not a style question. OpenNext 1.20.x requires Next
      // >=16.2.11, so a range lets a clean install select a runtime pair nobody
      // has built against — which is how an unverified pair shipped before PH-01.
      expect(installed[name], `${name} must be pinned exactly, and to the version capucor-os pins`).toBe(want);
    });
  }

  it('pins Node to the same version in .nvmrc and CI', () => {
    const want = contract.coupledDependencies.node.version;
    expect(read('.nvmrc').trim()).toBe(want);
    const versions = [...read('.github/workflows/ci.yml').matchAll(/node-version:\s*([\w.'"]+)/g)].map((m) =>
      m[1].replace(/['"]/g, ''),
    );
    expect(versions.length).toBeGreaterThan(0);
    // These drifted once — CI on 20, the box on 24 — and the symptom was `npm
    // ci` rejecting the lockfile outright rather than anything readable.
    for (const v of versions) expect(v).toBe(want);
  });
});

describe('hand-synced files', () => {
  for (const file of contract.handSynced.files) {
    it(`${file.path} is unchanged since the contract was recorded`, () => {
      const mode = file.pairMode === 'byte' ? 'byte' : 'code';
      const actual = digestFile(join(ROOT, file.path), mode);
      expect(actual, `${file.path} is missing from this repo`).not.toBeNull();
      expect(
        actual,
        `\n${file.path} has changed in capucor-web.\n` +
          `WHY THAT MATTERS: ${file.why}\n` +
          `Change capucor-os/${file.path} to match, then re-record both digests with\n` +
          `  npm run audit -- --print-digests   (in capucor-os)\n` +
          `and paste them into ALL THREE copies of cross-repo-contract.json.\n`,
      ).toBe(file.digest.web);
    });
  }
});

describe('the redirect seam this repo owns', () => {
  const config = read('next.config.ts');
  const spec = contract.routeSeam.web;

  it(`still declares ${spec.listName}`, () => {
    expect(config).toMatch(new RegExp(`const ${spec.listName}\\s*=\\s*\\[`));
  });

  for (const path of spec.mustContain) {
    it(`keeps "${path}" in ${spec.listName}`, () => {
      const list = config.match(new RegExp(`const ${spec.listName}\\s*=\\s*\\[([\\s\\S]*?)\\]`))![1];
      const entries = [...list.matchAll(/["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
      // These routes do not exist in this repo at all. The redirect is the only
      // thing between an old bookmark and a 404.
      expect(entries).toContain(path);
    });
  }

  for (const forbidden of contract.routeSeam.forbiddenSources) {
    it(`declares no redirect from "${forbidden}"`, () => {
      const escaped = forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(config, contract.routeSeam.forbiddenWhy).not.toMatch(
        new RegExp(`source:\\s*["'\`]${escaped}["'\`]`),
      );
    });
  }
});

describe('the provisioning seam this repo calls', () => {
  const p = contract.provisioning;
  const caller = read(p.caller.replace(/^capucor-web\//, ''));

  it(`still calls ${p.rpc}()`, () => {
    expect(caller).toContain(`'${p.rpc}'`);
  });

  for (const arg of p.args as string[]) {
    it(`passes "${arg}"`, () => {
      // PostgREST matches an RPC by ARGUMENT NAME, so a rename on either side is
      // a 404 at signing — no compile error, no failing type, and the symptom is
      // a paying client whose portal stage keeps retrying.
      expect(caller).toMatch(new RegExp(`\\b${arg}\\s*:`));
    });
  }

  it('keeps its tripwire test', () => {
    expect(existsSync(join(ROOT, 'src/__tests__/portal-provision.test.ts'))).toBe(true);
  });
});

describe('schema ownership', () => {
  it('has no supabase/migrations directory', () => {
    // capucor-os is the SOLE owner. This repo's stale copy was deleted in Phase
    // 3 of the OS split; a second copy is how two repos end up applying
    // different schemas to one database.
    expect(existsSync(join(ROOT, 'supabase', 'migrations'))).toBe(false);
  });
});
