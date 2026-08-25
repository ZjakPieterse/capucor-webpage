/**
 * Every verdict the CI-silence check can reach, driven off fixtures.
 *
 * WHY THIS AND NOT JUST THE DRILL. `CI_SILENCE_DRILL` exercises the failure path
 * against the real GitHub API, which is the evidence that matters — but it can
 * only reach the two conditions it knows how to fake. The verdicts that would
 * actually be reached during an incident (a run list the API refuses to return,
 * a commit inside the grace window that has not been validated *yet* and must
 * not go red) cannot be manufactured against a healthy repo.
 *
 * ⚠️ THE MOST IMPORTANT ASSERTIONS HERE ARE THE ONES ABOUT NOT FAILING. This
 * check runs daily and reports on a healthy repo every single day. A false
 * positive on a merge commit's own ancestors, or on a commit pushed two minutes
 * before the cron fired, is a check somebody switches off within a week — and
 * then the 2026-08-06 incident happens again with a green tick beside it.
 *
 * ⚠️ AND THE TWO THAT MUST NEVER DEGRADE TO A SKIP: an unreadable commit list
 * and an unreadable run list must both FAIL. "I could not look" and "everything
 * is fine" producing the same output is this check's own failure mode, one level
 * up.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// A zero-dependency .mjs, deliberately untyped and shared byte-identically with
// capucor-os — see ciSilence in the contract. The verdict shape is restated
// here rather than inferred, so a field renamed in the script shows up as a type
// error in the test that reads it.
import { evaluate, applyDrill, branchesFor, firstParentChain } from '../../scripts/ci-silence.mjs';
import { loadContract } from '../../contracts/contract.mjs';

interface Verdict {
  ok: boolean;
  reason: string;
  repo: string;
  file: string;
  branch: string;
  graceHours: number;
  lookbackDays: number;
  tip?: string | null;
  chainLength?: number;
  eligible?: number;
  unvalidated?: { sha: string; committedAt: string | null; ageDays: number }[];
}

const ROOT = process.cwd();
const contract = loadContract(join(ROOT, 'contracts'));
const NOW = new Date('2026-08-25T12:00:00Z');

/** Mirrors `withoutYamlComments` in scripts/audit-cross-repo.mjs — see there for why. */
const withoutComments = (text: string) =>
  text
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');

const declared = {
  repo: 'web',
  file: 'ci.yml',
  branch: 'master',
  graceHours: 6,
  lookbackDays: 14,
  why: 'capucor.com — the marketing funnel that mints proposals.',
};

const sha = (n: number) => String(n).padStart(40, '0');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

/**
 * A linear branch: newest first, each commit parented to the next, exactly what
 * `GET /commits?sha=master` returns for a repo with no merges.
 */
const linear = (ages: number[]) =>
  ages.map((h, i) => ({
    sha: sha(i),
    commit: { committer: { date: hoursAgo(h) } },
    parents: i + 1 < ages.length ? [{ sha: sha(i + 1) }] : [],
  }));

const check = (over: Record<string, unknown> = {}): Verdict =>
  evaluate({
    declared,
    commits: linear([24, 48, 72]),
    runShas: [sha(0), sha(1), sha(2)],
    graceHours: declared.graceHours,
    lookbackDays: declared.lookbackDays,
    now: NOW,
    ...over,
  }) as Verdict;

describe('the healthy case', () => {
  it('passes when every commit in the window has a run', () => {
    const r = check();
    expect(r.ok).toBe(true);
    expect(r.eligible).toBe(3);
    expect(r.unvalidated).toEqual([]);
  });

  it('⚠️ does not fail on a commit still inside the grace window', () => {
    // A commit pushed minutes before the cron fired has not been validated YET.
    // Failing on it would make the check red every morning for a reason nobody
    // can act on, and a gate that cries wolf is a gate somebody switches off.
    const r = check({ commits: linear([1, 48]), runShas: [sha(1)] });
    expect(r.ok).toBe(true);
    expect(r.eligible).toBe(1);
  });

  it('⚠️ does not fail on a commit older than the lookback window', () => {
    // lookbackDays is a WINDOW, not a threshold. An old unvalidated commit is
    // not forgiven here — it is simply no longer this check's subject, and the
    // deploy-drift check beside it is what notices an old unshipped commit.
    const r = check({ commits: linear([24, 20 * 24]), runShas: [sha(0)] });
    expect(r.ok).toBe(true);
    expect(r.eligible).toBe(1);
  });

  it('says so explicitly when the window is empty, rather than passing by luck', () => {
    const r = check({ commits: linear([1]), runShas: [] });
    expect(r.ok).toBe(true);
    expect(r.reason).toMatch(/nothing to validate and nothing is claimed/);
  });

  it('⚠️ ignores a merged branch’s own commits, which never had a push run', () => {
    // THE FALSE POSITIVE THAT WOULD HAVE MADE THIS CHECK USELESS. Both repos
    // merge pull requests as merge commits, so a push to master creates ONE
    // ci.yml run whose head is the merge commit. The commits inside the merged
    // branch are ancestors of master that were validated by `pull_request` runs
    // under a different head. Checking every ancestor reports each of them as
    // unvalidated and the check is red on a healthy repo within a day.
    const merge = {
      sha: sha(0),
      commit: { committer: { date: hoursAgo(24) } },
      parents: [{ sha: sha(1) }, { sha: sha(90) }],
    };
    const mainline = { sha: sha(1), commit: { committer: { date: hoursAgo(72) } }, parents: [] };
    const insideThePr = { sha: sha(90), commit: { committer: { date: hoursAgo(30) } }, parents: [] };
    const r = check({ commits: [merge, insideThePr, mainline], runShas: [sha(0), sha(1)] });
    expect(r.ok).toBe(true);
    expect(r.chainLength).toBe(2);
  });
});

describe('silence — the thing nothing else covers', () => {
  it('fails when a commit past the grace window has no run', () => {
    const r = check({ runShas: [sha(0), sha(2)] });
    expect(r.ok).toBe(false);
    expect(r.unvalidated).toHaveLength(1);
    expect(r.unvalidated?.[0].sha).toBe(sha(1));
    // The message has to carry the consequence and the action, not just a
    // count: whoever reads it may not know a dropped trigger is even possible.
    expect(r.reason).toContain('capucor.com');
    expect(r.reason).toMatch(/no run, no failure, no email, nothing red/);
    expect(r.reason).toContain('githubstatus.com');
  });

  it('reproduces the 2026-08-06 shape: two consecutive pushes lost', () => {
    // `4283406` at 21:01:33Z and `56e0acf` at 21:50:33Z produced no runs of any
    // kind while everything before them was green.
    const r = check({ runShas: [sha(2)] });
    expect(r.ok).toBe(false);
    expect(r.unvalidated).toHaveLength(2);
  });

  it('names the OLDEST unvalidated commit, because that is when it started', () => {
    const r = check({ commits: linear([24, 48, 72]), runShas: [] });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain(sha(2).slice(0, 7));
    expect(r.reason).toMatch(/landed 3\.0 days ago/);
  });

  it('⚠️ fails when the branch cannot be enumerated, and never passes instead', () => {
    const r = check({ commits: null });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/refuses to imply that all of them were validated/);
  });

  it('⚠️ fails when the run list cannot be read, and never passes instead', () => {
    const r = check({ runShas: null });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/refuses to guess/);
  });
});

describe('firstParentChain', () => {
  it('stops at the edge of the page rather than inventing commits', () => {
    // The answer is always a PREFIX of the true chain — a floor on what is
    // checked, never an invention. A short page means fewer commits examined,
    // not wrong ones.
    const page = [{ sha: sha(0), commit: { committer: { date: hoursAgo(1) } }, parents: [{ sha: sha(99) }] }];
    expect(firstParentChain(page)).toHaveLength(1);
  });

  it('terminates on a cycle rather than looping forever', () => {
    const a = { sha: sha(1), commit: { committer: { date: hoursAgo(1) } }, parents: [{ sha: sha(2) }] };
    const b = { sha: sha(2), commit: { committer: { date: hoursAgo(2) } }, parents: [{ sha: sha(1) }] };
    expect(firstParentChain([a, b])).toHaveLength(2);
  });

  it('returns nothing for an empty page', () => {
    expect(firstParentChain([])).toEqual([]);
  });
});

describe('the drill', () => {
  const observed = { declared, commits: linear([24, 48, 72]), runShas: [sha(0), sha(1), sha(2)] };

  it('silent removes the run for the oldest in-window commit', () => {
    // ⚠️ It forces the CONDITION, not a threshold. On a healthy repo every
    // commit has a run, so a threshold-moving drill would have nothing to act
    // on and would pass green — a drill that cannot fail is the bug it exists
    // to catch, one level up.
    const drilled = applyDrill(observed, 'silent') as typeof observed;
    expect(drilled.runShas).not.toContain(sha(2));
    const r = evaluate({
      ...drilled,
      graceHours: declared.graceHours,
      lookbackDays: declared.lookbackDays,
      now: NOW,
    }) as Verdict;
    expect(r.ok).toBe(false);
  });

  it('blind rewrites the commit list to absent', () => {
    const drilled = applyDrill(observed, 'blind') as { commits: unknown };
    expect(drilled.commits).toBeNull();
  });

  it('treats an unrecognised value as no drill', () => {
    // A typo in the workflow_dispatch input must not silently weaken the check.
    // It can only fail to strengthen it.
    const untouched = applyDrill(observed, 'off') as typeof observed;
    expect(untouched.runShas).toEqual(observed.runShas);
  });
});

describe('this repo is wired into the CI-silence check', () => {
  const slug = contract.scheduledWorkflows.githubRepos.web;

  it('selects only this repo’s release branches from the contract', () => {
    const { key, branches } = branchesFor(contract, slug);
    expect(key).toBe('web');
    expect(branches.length).toBeGreaterThan(0);
    for (const b of branches) expect(b.repo).toBe('web');
  });

  it('knows nothing about a repo the contract does not declare', () => {
    expect(branchesFor(contract, 'someone/else').branches).toEqual([]);
  });

  it('does not carry its own copy of the repo slugs', () => {
    expect(contract.ciSilence.githubReposFrom).toBe('scheduledWorkflows.githubRepos');
    expect(contract.ciSilence).not.toHaveProperty('githubRepos');
  });

  for (const b of contract.ciSilence.branches.filter((x: { repo: string }) => x.repo === 'web')) {
    it(`${b.file} exists here, still runs on push, and has usable windows`, () => {
      const wf = withoutComments(readFileSync(join(ROOT, '.github', 'workflows', b.file), 'utf8'));
      // If validation no longer runs on push, no commit is owed a run and this
      // check would report every one of them as unvalidated forever.
      expect(wf).toMatch(/^on:[\s\S]*?^\s*push:/m);
      expect(b.graceHours).toBeGreaterThan(0);
      expect(b.lookbackDays).toBeGreaterThan(0);
      expect(b.branch).toBeTruthy();
    });
  }

  it('⚠️ runs the check ON A SCHEDULE, which is the whole point of it', () => {
    // Hosted on the push trigger it exists to detect the loss of, this check is
    // decorative: it would report green on every push and never once fire when
    // the push path is the thing that failed.
    const wf = withoutComments(readFileSync(join(ROOT, contract.ciSilence.workflow), 'utf8'));
    expect(wf).toMatch(/^on:[\s\S]*?^\s*schedule:/m);
    expect(wf).toContain(contract.ciSilence.script);
    expect(wf).toMatch(/contents:\s*read/);
    expect(wf).toMatch(/actions:\s*read/);
    expect(wf, contract.backup.zeroDependencyWhy).not.toMatch(/^\s*run:\s*npm (ci|install)\b/m);
  });

  it('⚠️ carries if:always() on the CI-silence STEP, not merely somewhere in the file', () => {
    // The audit's own regression, 2026-08-25: three steps carry the attribute
    // now, and a file-wide match is satisfied by whichever one still has it.
    const wf = withoutComments(readFileSync(join(ROOT, contract.ciSilence.workflow), 'utf8'));
    const step = wf
      .split(/\n(?=\s*- (?:name|uses):)/)
      .find((s) => s.includes(`run: node ${contract.ciSilence.script}`));
    expect(step).toBeDefined();
    expect(step).toMatch(/if:\s*always\(\)/);
  });

  it('⚠️ declares watchdog.yml’s own schedule with event:schedule, so a push run cannot satisfy it', () => {
    // watchdog.yml runs on push AND schedule. Without the event filter, one of
    // its own push runs proves its schedule is alive — and a dead schedule is
    // invisible behind the very pushes it exists to outlive.
    const entries = contract.scheduledWorkflows.workflows.filter(
      (w: { file: string }) => w.file === 'watchdog.yml',
    );
    expect(entries.length).toBe(2);
    for (const w of entries) expect(w.event).toBe('schedule');
    const script = readFileSync(join(ROOT, contract.scheduledWorkflows.watchdogScript), 'utf8');
    expect(script).toContain('event=${declared.event}');
  });
});
