/**
 * Every verdict the deploy-drift check can reach, driven off fixtures.
 *
 * WHY THIS AND NOT JUST THE DRILL. `DEPLOY_DRIFT_DRILL` exercises the failure
 * path against the real GitHub API, which is the evidence that matters — but it
 * can only reach the two conditions it knows how to fake. The verdicts that
 * would actually be reached in an emergency (a deployed commit that has been
 * force-pushed out of existence, production serving a ref that diverged from
 * master) cannot be manufactured against a healthy repo without breaking
 * something real.
 *
 * ⚠️ THE MOST IMPORTANT ASSERTIONS HERE ARE THE TWO ABOUT NOT FAILING. Under
 * ADR 0010 part 1, `master` ahead of production is the NORMAL state, so a check
 * that goes red on every merge is a check somebody switches off within a week —
 * and the contract already learned that lesson once, for the crons. The
 * threshold must stay an AGE, never `ahead_by`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// A zero-dependency .mjs, deliberately untyped and shared byte-identically with
// capucor-os — see deployDrift in the contract. The verdict shape is restated
// here rather than inferred, so a field renamed in the script shows up as a type
// error in the test that reads it.
import { evaluate, applyDrill, deploymentsFor } from '../../scripts/deploy-drift.mjs';
import { loadContract } from '../../contracts/contract.mjs';

interface Verdict {
  ok: boolean;
  reason: string;
  repo: string;
  file: string;
  branch: string;
  maxAgeDays: number;
  ageDays?: number;
  aheadBy?: number;
  behindBy?: number;
  status?: string;
  deployedSha?: string;
  deployedFrom?: string | null;
  oldestUnshipped?: string;
}

const ROOT = process.cwd();
const contract = loadContract(join(ROOT, 'contracts'));
const NOW = new Date('2026-08-24T12:00:00Z');

/** Mirrors `withoutYamlComments` in scripts/audit-cross-repo.mjs — see there for why. */
const withoutComments = (text: string) =>
  text
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');

const declared = {
  repo: 'web',
  file: 'deploy.yml',
  branch: 'master',
  maxAgeDays: 7,
  why: 'capucor.com — the marketing funnel that mints proposals.',
};

const run = (sha = 'a'.repeat(40), updated = '2026-08-24T09:00:00Z', branch = 'master') => ({
  head_sha: sha,
  head_branch: branch,
  updated_at: updated,
  html_url: 'https://x',
});

/** `commits` comes back oldest-first from the compare API. */
const ahead = (n: number, oldestIso: string) => ({
  status: 'ahead',
  ahead_by: n,
  behind_by: 0,
  commits: [{ sha: 'b'.repeat(40), commit: { committer: { date: oldestIso } } }],
});

const check = (over: Record<string, unknown> = {}): Verdict =>
  evaluate({
    declared,
    run: run(),
    comparison: { status: 'identical', ahead_by: 0, behind_by: 0, commits: [] },
    maxAgeDays: declared.maxAgeDays,
    now: NOW,
    ...over,
  }) as Verdict;

describe('the healthy case', () => {
  it('passes when production is the tip of the branch', () => {
    const r = check();
    expect(r.ok).toBe(true);
    expect(r.reason).toContain('tip of master');
  });

  it('⚠️ passes while master is ahead but young, because that is NORMAL', () => {
    // ADR 0010 part 1 made deployment a manual dispatch, so every merge puts
    // master ahead of production. Failing here would go red on every single
    // merge, and a gate that cries wolf is a gate somebody switches off.
    const r = check({ comparison: ahead(2, '2026-08-24T08:00:00Z') });
    expect(r.ok).toBe(true);
    expect(r.aheadBy).toBe(2);
  });

  it('⚠️ does not gate on commit count, however large', () => {
    // Measured 2026-08-24: capucor-webpage was 21 commits ahead and 4.2 days
    // old — mostly generated types. Twenty-one commits of db.ts is not riskier
    // than one broken route. Age is the signal; ahead_by is context.
    const r = check({ comparison: ahead(500, '2026-08-24T06:00:00Z') });
    expect(r.ok).toBe(true);
    expect(r.aheadBy).toBe(500);
  });
});

describe('drift — the thing nothing else covers', () => {
  it('fails once the oldest unshipped commit is older than maxAgeDays', () => {
    const r = check({ comparison: ahead(3, '2026-08-15T12:00:00Z') });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/oldest has been waiting 9\.0 days/);
    // The message has to carry the consequence and the action, not just a
    // number: whoever reads it may not know this surface ships by hand.
    expect(r.reason).toContain('capucor.com');
    expect(r.reason).toContain('Dispatch deploy.yml');
  });

  it('measures the OLDEST unshipped commit, not the newest', () => {
    // A steady stream of recent merges must not reset the clock on a fix that
    // has been sitting unshipped for a fortnight.
    const r = check({ comparison: ahead(40, '2026-08-01T12:00:00Z') });
    expect(r.ok).toBe(false);
    expect(r.ageDays).toBeCloseTo(23, 0);
  });

  it('fails when the surface has never deployed successfully', () => {
    const r = check({ run: null, comparison: null });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/never completed a successful run/);
  });

  it('fails when the deployed commit no longer exists in the repository', () => {
    // A force-push or rewritten history. What is deployed is then not a commit
    // anybody can read, which no threshold should be allowed to excuse.
    const r = check({ comparison: null });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/force-push or a rewritten history/);
  });

  it.each(['behind', 'diverged'])('fails when production is "%s" relative to the branch', (status) => {
    const r = check({ comparison: { status, ahead_by: 1, behind_by: 4, commits: [] } });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/not on the release branch/);
  });
});

describe('a deploy dispatched from another ref is context, not a failure', () => {
  it('stays green and records which ref shipped', () => {
    // Shipping a hotfix from a branch is legitimate, and the comparison still
    // tells the truth about where production sits. Failing on it would punish
    // the one situation where somebody is already handling an incident.
    const r = check({ run: run('a'.repeat(40), '2026-08-24T09:00:00Z', 'hotfix/x') });
    expect(r.ok).toBe(true);
    expect(r.deployedFrom).toBe('hotfix/x');
  });
});

describe('the drill', () => {
  const observed = { declared, run: run(), comparison: { status: 'identical', ahead_by: 0, behind_by: 0, commits: [] } };

  it('drift forces a healthy surface over the line', () => {
    // ⚠️ It forces the CONDITION, not the threshold. With production at the tip
    // there is no unshipped commit for a maxAgeDays of 0 to act on, so a
    // threshold-moving drill would pass green — a drill that cannot fail is the
    // bug it exists to catch, one level up.
    const drilled = applyDrill(observed, 'drift') as typeof observed & { comparison: { ahead_by: number } };
    expect(drilled.comparison.ahead_by).toBe(99);
    const r = evaluate({ ...drilled, maxAgeDays: 7, now: new Date() }) as Verdict;
    expect(r.ok).toBe(false);
  });

  it('never rewrites the observed run to absent', () => {
    const drilled = applyDrill(observed, 'never') as { run: unknown };
    expect(drilled.run).toBeNull();
  });

  it('treats an unrecognised value as no drill', () => {
    // A typo in the workflow_dispatch input must not silently weaken the check.
    // It can only fail to strengthen it.
    const untouched = applyDrill(observed, 'off') as { comparison: { status: string } };
    expect(untouched.comparison.status).toBe('identical');
  });
});

describe('this repo is wired into the deploy-drift check', () => {
  const slug = contract.scheduledWorkflows.githubRepos.web;

  it('selects only this repo’s deployment surfaces from the contract', () => {
    const { key, deployments } = deploymentsFor(contract, slug);
    expect(key).toBe('web');
    expect(deployments.length).toBeGreaterThan(0);
    for (const d of deployments) expect(d.repo).toBe('web');
  });

  it('knows nothing about a repo the contract does not declare', () => {
    expect(deploymentsFor(contract, 'someone/else').deployments).toEqual([]);
  });

  it('does not carry its own copy of the repo slugs', () => {
    // deployDrift.githubReposWhy: a second copy of the owner/name map is a
    // second thing to forget when a repo is renamed.
    expect(contract.deployDrift.githubReposFrom).toBe('scheduledWorkflows.githubRepos');
    expect(contract.deployDrift).not.toHaveProperty('githubRepos');
  });

  for (const d of contract.deployDrift.deployments.filter((x: { repo: string }) => x.repo === 'web')) {
    it(`${d.file} exists here, ships by dispatch only, and has a usable threshold`, () => {
      const text = readFileSync(join(ROOT, '.github', 'workflows', d.file), 'utf8');
      expect(text).toMatch(/^on:[\s\S]*?^\s*workflow_dispatch:/m);
      // ADR 0010 part 1 and ADR 0003. A push trigger here would ship to
      // production unattended AND invalidate the threshold, which assumes
      // deployment is deliberate.
      expect(text).not.toMatch(/^on:[\s\S]*?^\s*push:/m);
      expect(d.maxAgeDays).toBeGreaterThan(0);
      expect(d.branch).toBeTruthy();
    });
  }

  it('runs the check on push, with contents:read, if:always() and no npm ci', () => {
    // ⚠️ COMMENTS ARE STRIPPED FIRST. watchdog.yml explains both `if: always()`
    // and `contents: read` in prose, so asserting against the raw file passes
    // on the explanation even after the real attribute is deleted. The audit
    // drill caught exactly that on 2026-08-24 — a check satisfied by its own
    // comment is not a check.
    const wf = withoutComments(readFileSync(join(ROOT, contract.deployDrift.workflow), 'utf8'));
    expect(wf).toMatch(/^on:[\s\S]*?^\s*push:/m);
    expect(wf).toMatch(/contents:\s*read/);
    expect(wf).toContain(contract.deployDrift.script);
    // Without if:always() a failing cron watchdog in the step above skips this
    // one, so the two failures could never be seen in the same run.
    expect(wf).toMatch(/if:\s*always\(\)/);
    expect(wf, contract.backup.zeroDependencyWhy).not.toMatch(/^\s*run:\s*npm (ci|install)\b/m);
  });

  it('declares every workflow in this repo that actually deploys', () => {
    // The inverse check. A deploying workflow with no contract entry is a
    // surface nothing watches, and it looks exactly like one that is fine.
    //
    // Comments are stripped first: ci.yml carries a line saying `wrangler
    // deploy` is precisely what no longer happens there, so a naive match
    // reports the workflow that PROVES ADR 0010 as a violation of it.
    const dir = join(ROOT, '.github', 'workflows');
    const onDisk = readdirSync(dir)
      .filter((f) => /\.ya?ml$/.test(f))
      .filter((f) => /wrangler deploy/.test(withoutComments(readFileSync(join(dir, f), 'utf8'))))
      .sort();
    const declaredHere = contract.deployDrift.deployments
      .filter((d: { repo: string }) => d.repo === 'web')
      .map((d: { file: string }) => d.file)
      .sort();
    expect(onDisk).toEqual(declaredHere);
  });
});
