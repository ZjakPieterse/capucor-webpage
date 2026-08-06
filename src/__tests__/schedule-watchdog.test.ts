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

// A zero-dependency .mjs, deliberately untyped and shared byte-identically with
// capucor-os — see scheduledWorkflows in the contract. The verdict shape is
// restated here rather than inferred, so a field renamed in the script shows up
// as a type error in the test that reads it.
import { evaluate, applyDrill, workflowsFor } from '../../scripts/schedule-watchdog.mjs';
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
    expect(wf, contract.backup.zeroDependencyWhy).not.toMatch(/^\s*run:\s*npm (ci|install)\b/m);
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
