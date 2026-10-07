#!/usr/bin/env node
/**
 * The scheduled-workflow watchdog. Asks one question per cron: IS IT STILL
 * RUNNING?
 *
 * WHY THIS EXISTS. Everything irreplaceable in this platform is kept alive by a
 * GitHub Actions cron — the daily database dump (both destinations), the email
 * reconciler, the POPIA lead prune. Every one of them fails the same way: it
 * stops, and the failure mode is an empty Actions history nobody looks at. A
 * backup that quietly stopped six weeks ago is worse than no backup, because it
 * buys confidence exactly where confidence is expensive.
 *
 * ⚠️ IT WATCHES FOR SILENCE, NOT FOR A CAUSE. That is the design decision that
 * matters. The cause everyone names is GitHub's 60-day inactivity disable, and
 * as of 2026-08-06 that rule does not even apply to the repo holding the backup
 * (see `scheduledWorkflows.inactivityRule` in the contract). It is one of many:
 * an expired secret, an exhausted minutes allowance on a private repo, a renamed
 * file, a schedule someone deleted, a job failing every night. Checking "is the
 * workflow disabled?" would have covered exactly one of those. Checking "when
 * did it last succeed?" covers all of them, including the ones nobody has
 * thought of yet.
 *
 * WHAT IT CANNOT DO, stated rather than implied. It runs on PUSH. It cannot fire
 * during the quiet period that causes the disable in the first place — no
 * in-repo mechanism can, because every in-repo mechanism is hosted by the thing
 * that goes quiet. What it gives you is this: the moment anyone comes back and
 * pushes, the build goes red and names the job that has been dead for six weeks,
 * instead of that being discovered during a restore. Anything stronger has to
 * live outside these repos — see capucor-docs/operations/backup-watchdog.md.
 *
 * ZERO DEPENDENCIES, on purpose. Plain `fetch` and the workflow's own
 * GITHUB_TOKEN. The watchdog workflow is checkout + setup-node + this file, with
 * no `npm ci`, for the same reason the cron jobs it watches have none: that is
 * the difference between a run billing one minute against the free 2,000 and
 * billing five. src/__tests__/schedule-watchdog.test.ts fails if an `npm ci` ever appears.
 *
 * USAGE
 *   node scripts/schedule-watchdog.mjs                 # in CI; reads GITHUB_REPOSITORY
 *   node scripts/schedule-watchdog.mjs --repo owner/name
 *   node scripts/schedule-watchdog.mjs --json
 *
 * ENVIRONMENT
 *   GITHUB_TOKEN            required. `actions: read` is enough.
 *   GITHUB_REPOSITORY       owner/name. Set automatically inside Actions.
 *   SCHEDULE_WATCHDOG_DRILL stale | disabled — see THE DRILL below.
 */

import { appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadContract } from '../contracts/contract.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DAY_MS = 86_400_000;
const API = 'https://api.github.com';

// ---------------------------------------------------------------------------
// The pure half — everything decidable without the network.
//
// Split out so src/__tests__/schedule-watchdog.test.ts can drive every failure
// path off fixtures. The verdicts below are the whole contract of this script;
// the fetching underneath is plumbing.
// ---------------------------------------------------------------------------

/**
 * ⚠️ THE DRILL. `SCHEDULE_WATCHDOG_DRILL` makes the condition this watchdog
 * exists to catch actually true, so the failure path can be exercised on demand
 * against the REAL API rather than being asserted about in a comment.
 *
 *   stale     — max age becomes 0 days, so a perfectly healthy daily cron reads
 *               as overdue and the run goes red. Exercises the common case.
 *   disabled  — the reported state is rewritten to `disabled_inactivity`,
 *               exercising the message that has to tell a future reader how to
 *               put it back.
 *
 * Same reasoning as PH-12's `R2_FIRE_DRILL`, and the same safety property: it
 * touches no secret, mutates nothing, and is a `workflow_dispatch` input on
 * watchdog.yml, so it is safe to run at any time. Re-run it after changing this
 * script or that workflow.
 */
export function applyDrill(observation, drill) {
  if (drill === 'stale') return { ...observation, maxAgeDays: 0 };
  if (drill === 'disabled') {
    return { ...observation, workflow: { ...(observation.workflow ?? {}), state: 'disabled_inactivity' } };
  }
  return observation;
}

const STATE_ADVICE = {
  disabled_inactivity:
    'GitHub disabled it after 60 days without repository activity. Re-enable it in ' +
    'Actions → the workflow → ⋯ → Enable workflow. A push does NOT re-enable it on its own.',
  disabled_manually: 'Somebody switched it off in the Actions UI. If that was deliberate, remove it from the contract instead.',
  disabled_fork: 'It is running in a fork, where schedules never fire.',
  deleted: 'The workflow no longer exists on the default branch.',
};

/**
 * One workflow, one verdict. `null` for `workflow` means the Actions API does
 * not know this file; `null` for `newestSuccess` means it has never completed
 * successfully at all.
 *
 * ⚠️ A FAILING LATEST RUN IS REPORTED, NOT FAILED ON, and that is deliberate.
 * GitHub already emails on a failed scheduled run, so a red night is loud
 * without us. Silence is the thing nothing else covers, and a job that keeps
 * failing crosses the staleness threshold on its own within maxAgeDays. Failing
 * here as well would also mean the R2 fire drill left every subsequent push red
 * until the next nightly run, which is how a gate gets switched off.
 *
 * ⚠️ AN ENTRY WITH `event` IS ASKED "DID IT FIRE", NOT "DID IT SUCCEED", AND
 * WITHOUT THAT THE WATCHDOG LATCHES ITSELF RED FOREVER. The only such entry is
 * watchdog.yml watching its own schedule, and its scheduled run executes THIS
 * check. Once any other step kept the schedule red for maxAgeDays (deploy drift,
 * 2026-09-15 → 09-18), every later scheduled run failed on "the schedule has not
 * succeeded" — which only a successful scheduled run could clear. capucor-webpage
 * sat red for three weeks with every schedule firing on time. `newestFired` is
 * the newest run that completed as success OR failure: both prove the dispatch
 * path is alive, which is the question eventWhy says this entry asks, and a
 * failing run is already emailed. Cancelled and startup_failure runs do not
 * count — they never reached the steps.
 */
export function evaluate({ declared, workflow, newestRun, newestSuccess, newestFired = null, maxAgeDays, now, listings = 0 }) {
  // Stated on a red verdict, so a reader knows it is not one listing's say-so.
  const agreed = listings > 1 ? ` All ${listings} differently shaped run listings agree.` : '';
  const base = { file: declared.file, why: declared.why, maxAgeDays, state: workflow?.state ?? null };
  const firedIsEnough = Boolean(declared.event);
  const evidence = firedIsEnough ? newestFired : newestSuccess;
  const verb = firedIsEnough ? 'fired' : 'succeeded';

  if (!workflow) {
    return {
      ...base,
      ok: false,
      reason:
        `the Actions API does not know ${declared.file}. It has been renamed, deleted, or never ` +
        `landed on the default branch — so nothing is running it and nothing was going to say so.`,
    };
  }

  if (workflow.state !== 'active') {
    return {
      ...base,
      ok: false,
      reason: `state is "${workflow.state}", not "active". ${STATE_ADVICE[workflow.state] ?? 'It is not scheduled to run.'}`,
    };
  }

  if (!evidence) {
    // ⚠️ A NEWLY DECLARED WORKFLOW HAS NOT RUN YET, AND THAT IS NOT A FAILURE —
    // for a bounded time, stated as a date in the contract. Without this, the
    // push that MERGES a new cron turns every subsequent push red until the
    // schedule first fires, which is a gate going red for a reason nobody can
    // act on: the fix is to wait. `notBefore` is the deadline by which the first
    // successful run must exist, and schedule-watchdog.test.ts refuses one more than three days
    // out so this cannot become an indefinite mute. Reported, never silent.
    if (declared.notBefore && now.getTime() < new Date(declared.notBefore).getTime()) {
      return {
        ...base,
        ok: true,
        pending: true,
        reason:
          `declared but not yet run — its first successful run is expected by ${declared.notBefore}. ` +
          `After that this row fails. ${declared.why}`,
      };
    }
    return {
      ...base,
      ok: false,
      reason:
        (firedIsEnough
          ? `it has never fired on its ${declared.event} trigger, so that dispatch path is not running it.`
          : `it has never completed successfully. Either it has only ever failed, or it has never ` +
            `been triggered — both mean the job this workflow exists to do is not being done.`) +
        (declared.notBefore ? ` Its first run was expected by ${declared.notBefore} and has not happened.` : '') +
        agreed,
    };
  }

  const ageDays = (now.getTime() - new Date(evidence.updated_at).getTime()) / DAY_MS;
  const shared = {
    ...base,
    ageDays,
    lastSuccess: evidence.updated_at,
    lastRunConclusion: newestRun?.conclusion ?? null,
    url: evidence.html_url ?? null,
  };

  if (ageDays > maxAgeDays) {
    return {
      ...shared,
      ok: false,
      reason:
        `last ${verb} ${ageDays.toFixed(1)} days ago, and the contract allows ${maxAgeDays}. ` +
        `${declared.why} Check the Actions tab: a schedule that has gone quiet, an expired ` +
        `secret and an exhausted minutes allowance all look identical from here.${agreed}`,
    };
  }

  return { ...shared, ok: true, reason: `last ${verb} ${ageDays.toFixed(1)} days ago (limit ${maxAgeDays})` };
}

/** Which declared workflows belong to the repo we are running in. */
export function workflowsFor(contract, repoSlug) {
  const spec = contract.scheduledWorkflows;
  const key = Object.entries(spec.githubRepos).find(([, slug]) => slug.toLowerCase() === repoSlug.toLowerCase())?.[0];
  return { key, workflows: key ? spec.workflows.filter((w) => w.repo === key) : [] };
}

// ---------------------------------------------------------------------------
// The network half
// ---------------------------------------------------------------------------

function fail(message) {
  console.error(`\n::error::${message}`);
  process.exit(1);
}

async function gh(path, token) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'capucor-schedule-watchdog',
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    // ⚠️ Never degrade to "assume it is fine". A watchdog that answers "I could
    // not check" with a green tick is the exact bug it exists to catch, one
    // level up.
    fail(
      `GET ${path} returned ${res.status} ${res.statusText}. The watchdog could not read the ` +
        `Actions API, so it does not know whether the crons are running — and refuses to imply ` +
        `they are. A 401/403 here is the token: the job needs \`permissions: actions: read\`.`,
    );
  }
  return res.json();
}

/** How many runs the unfiltered listing reads. Daily crons: weeks. Hourly: most of a day. */
const PAGE = 50;

/**
 * Builds one observation from two DIFFERENTLY SHAPED run listings. `get` is
 * `(path) => json | null`, injected so the tests can drive the stale-listing
 * case off fixtures.
 *
 * ⚠️ A FILTERED LISTING IS NOT EVIDENCE OF ABSENCE. Measured 2026-10-07: the
 * `status=success` listing returned a run ~19 days old for two crons that had
 * succeeded that morning, so this watchdog went red three times in one day on
 * healthy crons. What a listing DOES return is real — a stale listing only
 * ever makes a workflow look older, never newer — so the freshest qualifying
 * run across both listings is a safe answer, and a stale or "never" verdict
 * only stands when both agree:
 *
 *   1. the newest PAGE runs with no status or event filter, the newest
 *      success / fired run picked here. This shape stayed current throughout.
 *   2. the exact `status=success` (and, for an `event` entry,
 *      `status=failure`) queries this watchdog used to rely on alone.
 *
 * ⚠️ OPTIONAL `event`, AND IT IS LOAD-BEARING ON EXACTLY ONE ENTRY. watchdog.yml
 * runs on push AND schedule, so without it one of its own push runs would
 * satisfy its own staleness check. It filters listing 2 on the server and
 * listing 1 here. See scheduledWorkflows.eventWhy.
 */
export async function observe(declared, repoSlug, get) {
  const base = `/repos/${repoSlug}/actions/workflows/${declared.file}`;
  const workflow = await get(base);
  if (!workflow) return { declared, workflow: null, newestRun: null, newestSuccess: null, newestFired: null, listings: 0 };

  const event = declared.event ? `&event=${declared.event}` : '';
  const [page, successes, failures] = await Promise.all([
    get(`${base}/runs?per_page=${PAGE}&exclude_pull_requests=true`),
    get(`${base}/runs?status=success&per_page=1&exclude_pull_requests=true${event}`),
    declared.event ? get(`${base}/runs?status=failure&per_page=1&exclude_pull_requests=true${event}`) : null,
  ]);

  const fromPage = pickRuns(page?.workflow_runs, declared.event);
  const fromExact = pickRuns([...(successes?.workflow_runs ?? []), ...(failures?.workflow_runs ?? [])], declared.event);

  return {
    declared,
    workflow,
    newestRun: fromPage.newestRun ?? fromExact.newestRun,
    newestSuccess: freshest(fromPage.newestSuccess, fromExact.newestSuccess),
    newestFired: freshest(fromPage.newestFired, fromExact.newestFired),
    listings: 2,
  };
}

/** The newest run, newest success and newest fired (success or failure) run in a listing. */
export function pickRuns(runs, event) {
  const mine = (Array.isArray(runs) ? runs : [])
    .filter((r) => !event || r.event === event)
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  return {
    newestRun: mine[0] ?? null,
    newestSuccess: mine.find((r) => r.conclusion === 'success') ?? null,
    newestFired: mine.find((r) => r.conclusion === 'success' || r.conclusion === 'failure') ?? null,
  };
}

/** The most recently updated of the given runs; nulls ignored. */
export function freshest(...runs) {
  return runs.filter(Boolean).sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0] ?? null;
}

// ---------------------------------------------------------------------------
// CLI — guarded so the exports above stay importable from Vitest.
// ---------------------------------------------------------------------------

const isCli = process.argv[1] && process.argv[1].split(/[\\/]/).pop() === 'schedule-watchdog.mjs';

if (isCli) {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const repoArg = args.indexOf('--repo');
  const repoSlug = repoArg !== -1 ? args[repoArg + 1] : process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const drill = process.env.SCHEDULE_WATCHDOG_DRILL || '';

  if (!repoSlug) {
    fail('No repository. Set GITHUB_REPOSITORY (Actions does this) or pass --repo owner/name.');
  }
  if (!token) {
    // Deliberately NOT a skip. Several gates in this repo self-arm by skipping
    // while a piece is missing; this one must not, because "the token is gone"
    // and "the crons are gone" produce the same silence.
    fail(
      'GITHUB_TOKEN is not set, so the watchdog cannot see the Actions API. It refuses to skip: ' +
        'a watchdog that silently stops watching is the failure it exists to catch.',
    );
  }

  const contract = loadContract(join(HERE, '..', 'contracts'));
  const { key, workflows } = workflowsFor(contract, repoSlug);

  if (!key) {
    fail(
      `${repoSlug} is not in scheduledWorkflows.githubRepos in the contract manifest, so the ` +
        `watchdog does not know which crons to expect here. Declare it in ` +
        `contracts/web-contract.json.`,
    );
  }
  if (!workflows.length) {
    fail(`The contract declares no scheduled workflows for ${repoSlug}, but this watchdog is wired up here.`);
  }

  if (drill) {
    console.log(`🔥 SCHEDULE_WATCHDOG_DRILL=${drill} — forcing the failure path on purpose.`);
    console.log('   This run MUST go red. A green run here means the watchdog is not gating.\n');
  }

  const now = new Date();
  const results = [];
  for (const declared of workflows) {
    const observation = await observe(declared, repoSlug, (path) => gh(path, token));
    const drilled = applyDrill({ ...observation, maxAgeDays: declared.maxAgeDays }, drill);
    results.push(evaluate({ ...drilled, now }));
  }

  const broken = results.filter((r) => !r.ok);

  if (asJson) {
    console.log(JSON.stringify({ ok: broken.length === 0, repo: repoSlug, results }, null, 2));
  } else {
    console.log(`Scheduled-workflow watchdog — ${repoSlug}\n`);
    for (const r of results) {
      console.log(`${r.ok ? '✓' : '✗'} ${r.file.padEnd(34)} ${r.reason}`);
    }
    console.log('');
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      [
        `### Scheduled-workflow watchdog — ${repoSlug}`,
        '',
        '| Workflow | Last success | Age | Limit | |',
        '|---|---|---|---|---|',
        ...results.map(
          (r) =>
            `| \`${r.file}\` | ${r.lastSuccess ?? '—'} | ${r.ageDays === undefined ? '—' : `${r.ageDays.toFixed(1)}d`} ` +
            `| ${r.maxAgeDays}d | ${r.ok ? '✅' : '❌'} |`,
        ),
        '',
        broken.length
          ? '❌ At least one scheduled job has gone quiet. Nothing is running it and nothing else would have said so.'
          : '✅ Every declared cron has succeeded inside its window.',
        '',
      ].join('\n'),
    );
  }

  if (broken.length) {
    for (const r of broken) console.error(`::error::${r.file}: ${r.reason}`);
    console.error(
      `\n${broken.length} of ${results.length} scheduled workflow(s) are not running as declared. ` +
        `See scheduledWorkflows in contracts/web-contract.json.`,
    );
    process.exitCode = 1;
  } else {
    console.log(`All ${results.length} declared scheduled workflow(s) are active and current.`);
  }
}
