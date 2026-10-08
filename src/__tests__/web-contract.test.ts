/**
 * The web contract — the invariants this repository enforces on itself.
 *
 * The manifest is contracts/web-contract.json. Since web-standalone phase 2
 * (2026-10-07) it is web-owned and compares nothing with another repo: pricing,
 * tiers, db.ts and the rest are this repo's own files. What stays is what still
 * protects this repo alone — exact runtime pins, the redirect table, two
 * written rules, schema ownership. Phase 3 (2026-10-07) deleted the two
 * temporary entries, the provisioning RPC boundary and the messages.mjs freeze.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { loadContract } from '../../contracts/contract.mjs';

const ROOT = process.cwd();
const contract = loadContract(join(ROOT, 'contracts'));
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

describe('pinned dependencies', () => {
  const pkg = JSON.parse(read('package.json'));
  const installed: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };

  for (const [name, want] of Object.entries(contract.coupledDependencies.exact)) {
    it(`pins ${name} to exactly ${want}`, () => {
      // A caret here is not a style question. OpenNext requires a minimum Next
      // and Wrangler, so a range lets a clean install select a runtime set
      // nobody has built against — which is how an unverified pair shipped
      // before PH-01.
      expect(installed[name], `${name} must be pinned exactly`).toBe(want);
    });
  }

  it('keeps Next, OpenNext and Wrangler in the exact list together', () => {
    for (const name of contract.coupledDependencies.triple) {
      expect(contract.coupledDependencies.exact, contract.coupledDependencies.why).toHaveProperty(name);
    }
  });

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

describe('the redirect table this repo owns', () => {
  const config = read(contract.routeSeam.file);
  const spec = contract.routeSeam;

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

  for (const forbidden of spec.forbiddenSources) {
    it(`declares no redirect from "${forbidden}"`, () => {
      const escaped = forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(config, spec.forbiddenWhy).not.toMatch(new RegExp(`source:\\s*["'\`]${escaped}["'\`]`));
    });
  }
});

describe('written rules', () => {
  // Fenced code is stripped both ways; blockquotes only for mustNotMatch, so a
  // corrected claim quoted beside its correction does not trip the check.
  const stripFences = (s: string) => s.replace(/```[\s\S]*?```/g, '');
  const stripQuotes = (s: string) =>
    s
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('>'))
      .join('\n');

  for (const rule of contract.rules) {
    for (const file of rule.files as string[]) {
      it(`${file} carries "${rule.title}"`, () => {
        const text = stripFences(read(file));
        expect(text, rule.why).toMatch(new RegExp(rule.mustMatch, 'i'));
        expect(stripQuotes(text), rule.mustNotMatchWhy).not.toMatch(new RegExp(rule.mustNotMatch, 'i'));
      });
    }
  }
});

describe('schema ownership', () => {
  // Since 2026-10-07 (web-standalone phase 1) this repo owns the funnel schema.
  // The baseline records what is already live and must never run: its first
  // statement raises, so an accidental apply aborts before creating anything.
  const baseline = join('supabase', 'migrations', '000_baseline_funnel.sql');

  it('keeps the funnel baseline record', () => {
    expect(existsSync(join(ROOT, baseline))).toBe(true);
  });

  it('keeps the never-apply tripwire as the first statement', () => {
    const sql = read(baseline)
      .split('\n')
      .filter((line) => line.trim() !== '' && !line.trim().startsWith('--'));
    expect(sql[0]).toBe('do $$ begin');
    expect(sql[1]).toContain('raise exception');
  });
});
