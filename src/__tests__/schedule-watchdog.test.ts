/**
 * Every verdict the scheduled-workflow watchdog can reach, driven off fixtures.
 *
 * WHY THIS AND NOT JUST THE DRILL. `SCHEDULE_WATCHDOG_DRILL` exercises the
 * failure path against the real Actions API, which is the evidence that matters
 * — but it can only reach the two conditions it knows how to fake. The verdicts
 * that would actually be reached in an emergency (a workflow the API has never
 * heard of, a cron that has never once succeeded) cannot be manufactured against
 * a healthy repo without breaking something real.
 *
 * ⚠️ THE MOST IMPORTANT ASSERTIONS HERE ARE THE ONES ABOUT NOT PASSING. A
 * watchdog that answers "I could not check" with a green tick is the exact bug
 * it exists to catch, one level up. Nothing below may ever be allowed to soften
 * into a skip.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// A zero-dependency .mjs, deliberately untyped (it runs without `npm ci`) — see scheduledWorkflows in the contract. The verdict shape is
// restated here rather than inferred, so a field renamed in the script shows up
// as a type error in the test that reads it.
import { evaluate, applyDrill, workflowsFor, observe, pickRuns, freshest } from '../../scripts/schedule-watchdog.mjs';
import { loadContract } from '../../contracts/contract.mjs';

interface Verdict {
  ok: boolean;
  reason: string;
  file: string;
  state: string | null;
  maxAgeDays: number;
  ageDays?: number;
  lastSuccess?: string;
  lastRunConclusion?: string | null;
}

const ROOT = process.cwd();
const contract = loadContract(join(ROOT, 'contracts'));
const NOW = new Date('2026-08-06T12:00:00Z');

const declared = {
  repo: 'web',
  file: 'cron-prune-leads.yml',
  schedule: '15 3 * * *',
  maxAgeDays: 3,
  why: 'The POPIA retention job.',
};
const active = { state: 'active' };
const runAt = (iso: string, conclusion = 'success') => ({ updated_at: iso, conclusion, html_url: 'https://x' });

const check = (over: Record<string, unknown> = {}): Verdict =>
  evaluate({
    declared,
    workflow: active,
    newestRun: runAt('2026-08-06T02:04:00Z'),
    newestSuccess: runAt('2026-08-06T02:04:00Z'),
    maxAgeDays: declared.maxAgeDays,
    now: NOW,
    ...over,
  }) as Verdict;

describe('the healthy case', () => {
  it('passes when the newest success is inside the window', () => {
    const r = check();
    expect(r.ok).toBe(true);
    expect(r.ageDays).toBeLessThan(1);
  });

  it('tolerates a late run, because GitHub delays schedules under load', () => {
    // Measured 2026-08-06: capucor-webpage crons scheduled for 03:15/03:30 UTC
    // ran between 06:01 and 06:44. A one-day threshold would cry wolf, and a
    // gate that cries wolf gets switched off.
    expect(check({ newestSuccess: runAt('2026-08-04T06:44:00Z') }).ok).toBe(true);
  });
});

describe('silence — the thing nothing else covers', () => {
  it('fails once the newest success is older than maxAgeDays', () => {
    const r = check({ newestSuccess: runAt('2026-08-01T02:04:00Z') });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/last succeeded 5\.4 days ago/);
    // The message has to carry the consequence, not just the number: whoever
    // reads it is seeing this workflow's name for the first time in months.
    expect(r.reason).toContain('The POPIA retention job.');
  });

  it('fails when the workflow has never completed successfully', () => {
    const r = check({ newestSuccess: null, newestRun: runAt('2026-08-06T02:04:00Z', 'failure') });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/never completed successfully/);
  });

  it('⚠️ still fails when a spent notBefore grace has passed', () => {
    // The grace is a DEADLINE, not a mute. Once the date is behind us a
    // workflow that has still never run is exactly the silence this exists to
    // catch, and the message must say the first run was expected and missed.
    const r = check({
      declared: { ...declared, notBefore: '2026-08-01T06:00:00Z' },
      newestSuccess: null,
      newestRun: null,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/first run was expected by 2026-08-01T06:00:00Z and has not happened/);
  });
});

describe('a newly declared workflow that has not run yet', () => {
  it('⚠️ reports as pending rather than failing, before its notBefore', () => {
    // Without this, the push that MERGES a new cron turns every subsequent push
    // red until the schedule first fires — a gate red for a reason whose only
    // fix is to wait, which is how a gate gets switched off. R-12b hit exactly
    // this when watchdog.yml became a declared cron in the same change that
    // gave it a schedule.
    const r = check({
      declared: { ...declared, notBefore: '2026-08-09T06:00:00Z' },
      newestSuccess: null,
      newestRun: null,
    }) as Verdict & { pending?: boolean };
    expect(r.ok).toBe(true);
    expect(r.pending).toBe(true);
    expect(r.reason).toMatch(/declared but not yet run/);
    // It must name the deadline, so a reader knows this is temporary and when
    // it stops being tolerated.
    expect(r.reason).toContain('2026-08-09T06:00:00Z');
  });

  it('⚠️ the contract keeps every notBefore inside the three-day bound', () => {
    // A notBefore far in the future silences a dead cron indefinitely. A date
    // more than three days from the moment the tests run fails, offline. (Until
    // 2026-10-07 this measured from a fixed 2026-08-25, which would have refused
    // every later grace.) A past date is fine: the watchdog then fails normally.
    for (const w of contract.scheduledWorkflows.workflows as { file: string; notBefore?: string }[]) {
      if (!w.notBefore) continue;
      const when = new Date(w.notBefore).getTime();
      expect(Number.isNaN(when), `${w.file} notBefore is not a date`).toBe(false);
      expect(when - Date.now(), `${w.file} notBefore is more than three days away`).toBeLessThanOrEqual(3 * 86_400_000);
    }
  });
});

describe('a workflow the Actions API cannot find', () => {
  it('fails when the Actions API has never heard of the file', () => {
    const r = check({ workflow: null, newestRun: null, newestSuccess: null });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/renamed, deleted, or never/);
  });
});

describe('a disabled workflow is named precisely', () => {
  it('fails on disabled_inactivity and says a push will not undo it', () => {
    const r = check({ workflow: { state: 'disabled_inactivity' } });
    expect(r.ok).toBe(false);
    // The one fact that turns this message into an action. Someone who assumes
    // pushing fixes it walks away believing the backup is running again.
    expect(r.reason).toMatch(/A push does NOT re-enable it/);
  });

  it.each(['disabled_manually', 'disabled_fork', 'deleted'])('fails on state %s', (state) => {
    expect(check({ workflow: { state } }).ok).toBe(false);
  });
});

describe('a failing latest run is context, not a failure', () => {
  it('stays green while a recent success is inside the window', () => {
    // Deliberate. GitHub emails on a failed scheduled run, so a red night is
    // already loud; a job that keeps failing goes stale on its own. Failing here
    // too would leave every push red after an intentional R2 fire drill.
    const r = check({ newestRun: runAt('2026-08-06T02:04:00Z', 'failure'), newestSuccess: runAt('2026-08-05T02:04:00Z') });
    expect(r.ok).toBe(true);
    expect(r.lastRunConclusion).toBe('failure');
  });
});

describe('the drill', () => {
  const drill = (mode: string) =>
    applyDrill({ workflow: active, maxAgeDays: 3 }, mode) as { workflow: { state: string }; maxAgeDays: number };

  it('stale forces a healthy cron over the line', () => {
    const drilled = drill('stale');
    expect(drilled.maxAgeDays).toBe(0);
    expect(check({ ...drilled, declared }).ok).toBe(false);
  });

  it('disabled rewrites the reported state', () => {
    expect(drill('disabled').workflow.state).toBe('disabled_inactivity');
  });

  it('treats an unrecognised value as no drill', () => {
    // A typo in the workflow_dispatch input must not silently weaken the check.
    // It can only fail to strengthen it.
    const untouched = drill('off');
    expect(untouched.maxAgeDays).toBe(3);
    expect(untouched.workflow.state).toBe('active');
  });
});

describe('this repo is wired into the watchdog', () => {
  const slug = contract.scheduledWorkflows.githubRepos.web;

  it('selects only this repo’s crons from the contract', () => {
    const { key, workflows } = workflowsFor(contract, slug);
    expect(key).toBe('web');
    expect(workflows.length).toBeGreaterThan(0);
    for (const w of workflows) expect(w.repo).toBe('web');
  });

  it('knows nothing about a repo the contract does not declare', () => {
    expect(workflowsFor(contract, 'someone/else').workflows).toEqual([]);
  });

  for (const w of contract.scheduledWorkflows.workflows.filter((x: { repo: string }) => x.repo === 'web')) {
    it(`${w.file} exists here and still declares "${w.schedule}"`, () => {
      const text = readFileSync(join(ROOT, '.github', 'workflows', w.file), 'utf8');
      expect(text).toContain(w.schedule);
      expect(w.maxAgeDays).toBeGreaterThan(0);
    });
  }

  it('runs the watchdog on push, with actions:read and no npm ci', () => {
    const wf = readFileSync(join(ROOT, contract.scheduledWorkflows.watchdogWorkflow), 'utf8');
    expect(wf).toMatch(/^on:[\s\S]*?^\s*push:/m);
    expect(wf).toMatch(/actions:\s*read/);
    expect(wf).toContain(contract.scheduledWorkflows.watchdogScript);
    // Same zero-dependency rule as the crons it watches — and this one runs on
    // EVERY push.
    expect(wf, contract.scheduledWorkflows.zeroDependencyWhy).not.toMatch(/^\s*run:\s*npm (ci|install)\b/m);
  });

  it('declares every cron workflow in this repo', () => {
    // The inverse check. A cron added without a contract entry is a job nothing
    // watches, and it looks exactly like a job that is fine.
    const dir = join(ROOT, '.github', 'workflows');
    const onDisk = readdirSync(dir)
      .filter((f) => /\.ya?ml$/.test(f))
      .filter((f) => /^\s*-\s*cron:/m.test(readFileSync(join(dir, f), 'utf8')))
      .sort();
    const declaredHere = contract.scheduledWorkflows.workflows
      .filter((w: { repo: string }) => w.repo === 'web')
      .map((w: { file: string }) => w.file)
      .sort();
    expect(onDisk).toEqual(declaredHere);
  });
});

describe('⚠️ an `event` entry is asked whether it FIRED, not whether it succeeded', () => {
  // The only such entry is watchdog.yml watching its own schedule, and its
  // scheduled run executes this very check. Asking "did it succeed" there is a
  // latch: once any other step kept the schedule red for maxAgeDays, every later
  // scheduled run failed on its own staleness, which only a successful scheduled
  // run could clear. capucor-webpage sat red 2026-09-15 → 10-06 that way with
  // every schedule firing on time.
  const self = { ...declared, file: 'watchdog.yml', event: 'schedule' };

  it('passes on a recent FAILED scheduled run, so the watchdog cannot latch itself red', () => {
    const r = check({
      declared: self,
      newestSuccess: runAt('2026-07-15T02:00:00Z'),
      newestFired: runAt('2026-08-06T02:00:00Z', 'failure'),
    });
    expect(r.ok).toBe(true);
    expect(r.reason).toMatch(/last fired 0\.4 days ago/);
  });

  it('still fails when the schedule has not fired inside the window', () => {
    const r = check({ declared: self, newestFired: runAt('2026-08-01T02:00:00Z', 'failure') });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/last fired 5\.4 days ago/);
  });

  it('fails when the schedule has never fired', () => {
    const r = check({ declared: self, newestSuccess: null, newestFired: null, newestRun: null });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/never fired on its schedule trigger/);
  });

  it('an entry WITHOUT `event` still needs a success — a failing cron is not a running cron', () => {
    const r = check({
      newestSuccess: runAt('2026-08-01T02:00:00Z'),
      newestFired: runAt('2026-08-06T02:00:00Z', 'failure'),
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/last succeeded 5\.4 days ago/);
  });
});

describe('⚠️ a stale filtered listing cannot turn a healthy cron red', () => {
  // Measured 2026-10-07: the `status=success` listing returned a run ~19 days
  // old for two crons that had succeeded that morning, and this watchdog went
  // red on healthy crons three times in one day. A filtered listing is not
  // evidence of absence; a red verdict has to survive a second, differently
  // shaped listing (the unfiltered page).
  const REPO = 'owner/name';
  const run = (iso: string, conclusion = 'success', event = 'schedule') => ({
    updated_at: iso,
    conclusion,
    event,
    html_url: 'https://x',
  });
  const listing = (...runs: unknown[]) => ({ workflow_runs: runs });

  /** A fake Actions API: the unfiltered page and the status-filtered queries answer separately. */
  const api = (opts: {
    state?: string | null;
    page?: unknown[];
    success?: unknown[];
    failure?: unknown[];
  }) => {
    const calls: string[] = [];
    const get = async (path: string) => {
      calls.push(path);
      if (!path.includes('/runs')) return opts.state === null ? null : { state: opts.state ?? 'active' };
      if (path.includes('status=success')) return listing(...(opts.success ?? []));
      if (path.includes('status=failure')) return listing(...(opts.failure ?? []));
      return listing(...(opts.page ?? []));
    };
    return { get, calls };
  };

  const verdict = async (a: ReturnType<typeof api>, d: Record<string, unknown> = declared) => {
    const o = await observe(d, REPO, a.get);
    return evaluate({ ...o, maxAgeDays: (d as { maxAgeDays: number }).maxAgeDays, now: NOW }) as Verdict;
  };

  it('stays green when status=success is 19 days stale but the unfiltered page has today’s success', async () => {
    const a = api({ page: [run('2026-08-06T03:20:00Z')], success: [run('2026-07-18T03:20:00Z')] });
    const r = await verdict(a);
    expect(r.ok).toBe(true);
    expect(r.lastSuccess).toBe('2026-08-06T03:20:00Z');
    // Both shapes were actually asked, so neither is trusted alone.
    expect(a.calls.some((c) => /\/runs\?per_page=\d+&exclude_pull_requests=true$/.test(c))).toBe(true);
    expect(a.calls.some((c) => c.includes('status=success'))).toBe(true);
  });

  it('stays green the other way round too: a stale page, a current exact query', async () => {
    const r = await verdict(api({ page: [run('2026-07-18T03:20:00Z')], success: [run('2026-08-06T03:20:00Z')] }));
    expect(r.ok).toBe(true);
  });

  it('a newest run that failed does not hide an older success on the same page', async () => {
    const r = await verdict(api({ page: [run('2026-08-06T03:20:00Z', 'failure'), run('2026-08-05T03:20:00Z')] }));
    expect(r.ok).toBe(true);
    expect(r.lastRunConclusion).toBe('failure');
  });

  it('⚠️ a genuinely stale cron is still red — both listings agree, and the message says so', async () => {
    const r = await verdict(
      api({ page: [run('2026-08-06T03:20:00Z', 'failure'), run('2026-07-30T03:20:00Z')], success: [run('2026-07-30T03:20:00Z')] }),
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/last succeeded 7\.4 days ago/);
    expect(r.reason).toMatch(/All 2 differently shaped run listings agree/);
  });

  it('⚠️ a cron that has never succeeded in either listing is still red', async () => {
    const r = await verdict(api({ page: [run('2026-08-06T03:20:00Z', 'failure')] }));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/never completed successfully/);
  });

  it('⚠️ a disabled cron is still red, however fresh its last success', async () => {
    const r = await verdict(api({ state: 'disabled_inactivity', page: [run('2026-08-06T03:20:00Z')] }));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/A push does NOT re-enable it/);
  });

  it('⚠️ a workflow the API does not know is still red', async () => {
    expect((await verdict(api({ state: null }))).ok).toBe(false);
  });

  it('⚠️ an `event` entry ignores runs from other triggers on the unfiltered page', async () => {
    // watchdog.yml: a push run today must not satisfy "has the schedule fired".
    const self = { ...declared, file: 'watchdog.yml', event: 'schedule' };
    const r = await verdict(
      api({ page: [run('2026-08-06T09:00:00Z', 'success', 'push'), run('2026-07-30T06:00:00Z')], success: [run('2026-07-30T06:00:00Z')] }),
      self,
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/last fired 7\.3 days ago/);
  });

  it('an `event` entry is rescued by a fresh scheduled run on the page when the exact queries are stale', async () => {
    const self = { ...declared, file: 'watchdog.yml', event: 'schedule' };
    const r = await verdict(
      api({ page: [run('2026-08-06T06:30:00Z', 'failure')], success: [run('2026-07-18T06:00:00Z')], failure: [run('2026-07-19T06:00:00Z', 'failure')] }),
      self,
    );
    expect(r.ok).toBe(true);
  });

  it('the stale drill still goes red through both listings', async () => {
    const a = api({ page: [run('2026-08-06T03:20:00Z')], success: [run('2026-08-06T03:20:00Z')] });
    const o = await observe(declared, REPO, a.get);
    const r = evaluate({ ...applyDrill({ ...o, maxAgeDays: 3 }, 'stale'), now: NOW }) as Verdict;
    expect(r.ok).toBe(false);
  });

  it('pickRuns / freshest choose by updated_at and ignore nulls', () => {
    const picked = pickRuns([run('2026-08-01T00:00:00Z'), run('2026-08-03T00:00:00Z', 'cancelled')], undefined);
    expect(picked.newestRun?.conclusion).toBe('cancelled');
    expect(picked.newestSuccess?.updated_at).toBe('2026-08-01T00:00:00Z');
    expect(picked.newestFired?.updated_at).toBe('2026-08-01T00:00:00Z');
    expect(freshest(null, run('2026-08-01T00:00:00Z'), run('2026-08-02T00:00:00Z'))?.updated_at).toBe('2026-08-02T00:00:00Z');
    expect(freshest(null, null)).toBeNull();
  });
});
