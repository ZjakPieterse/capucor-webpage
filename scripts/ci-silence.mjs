#!/usr/bin/env node
/**
 * The CI-silence check. Asks one question per release branch: DID VALIDATION
 * ACTUALLY RUN ON THE COMMITS THAT LANDED, OR DID THE TRIGGER GO MISSING?
 *
 * WHY THIS EXISTS. Risk R-12b. On 2026-08-06 a GitHub Actions incident
 * (impact: critical, 15:05Z → 00:14Z, "webhook triggers are currently throttled
 * ... approximately 15% of webhooks" in GitHub's own status history) dropped two
 * pushes to capucor-webpage. `4283406` at 21:01:33Z and `56e0acf` at 21:50:33Z
 * produced NO workflow runs of any kind. Nothing went red, the crons stayed
 * green, and capucor.com sat three commits behind master for two weeks. The gap
 * was found by hand on 2026-08-20, not by a control.
 *
 * ⚠️ THE DETECTOR IS NOT SELF-REFERENTIAL, AND THAT IS THE WHOLE DESIGN. The
 * risk register recorded the difficulty as "any in-repo check for 'did CI run on
 * this commit?' is hosted by the same push trigger that was dropped". That is
 * true of a PUSH-hosted check and false of a SCHEDULE-hosted one, and the
 * incident record proves it:
 *
 *     cron-prune-leads.yml      2026-08-07 05:03:01Z  schedule  success  56e0acf
 *     cron-expire-proposals.yml 2026-08-07 05:15:41Z  schedule  success  56e0acf
 *
 * The schedule dispatch path stayed up throughout and ran, seven hours after the
 * last dropped push, with `56e0acf` — the exact commit CI never validated — as
 * its head. A scheduled check asking this question would have gone red that
 * morning instead of the gap running to a fortnight. So this runs ON THE
 * SCHEDULE, not on the push, which is the opposite of the cron watchdog beside
 * it and for the opposite reason. See ciSilence.hostedOnTheScheduleNotThePush.
 *
 * ⚠️ IT ASKS "DID IT RUN", NOT "DID IT PASS". A failing run is loud already —
 * GitHub emails on it — and a red CI is somebody's problem within the hour.
 * Silence produces no run, therefore no failure, therefore no email, and that is
 * the thing nothing else covers. Same division of labour the cron watchdog
 * draws in reportsFailureDoesNotFailOnIt.
 *
 * ⚠️ IT WALKS THE FIRST-PARENT CHAIN, NOT EVERY COMMIT. Both repos merge pull
 * requests as merge commits, so a push to master creates ONE ci.yml run whose
 * `head_sha` is the merge commit. The commits INSIDE the merged branch are
 * ancestors of master that were never the head of a push to it — they were
 * validated by `pull_request` runs, under a different head. Checking every
 * ancestor would report each of them as unvalidated and the check would be red
 * on a healthy repo within a day. The first-parent chain from the tip is exactly
 * the set of commits that were ever the head of a push, which is exactly the set
 * a push trigger was owed. On a squash-merge repo the chain is every commit, so
 * this degrades correctly rather than silently narrowing.
 *
 * WHAT IT CANNOT DO, stated rather than implied.
 *
 *   1. A TOTAL ACTIONS OUTAGE TAKES BOTH PATHS. Schedules survived the
 *      2026-08-06 incident; that is evidence, not a guarantee. If Actions is
 *      wholly down nothing in-repo runs, and the control for that is the
 *      external one in capucor-docs/operations/backup-watchdog.md.
 *   2. IT WATCHES THE RELEASE BRANCH ONLY. A dropped `pull_request` trigger —
 *      where CI actually gates a merge — is invisible here. Deliberately out of
 *      the first cut: an un-run PR check leaves the PR visibly un-green in front
 *      of the person merging it, which is a signal a dropped push trigger on
 *      master does not have.
 *   3. DETECTION IS SAME-DAY, NOT IMMEDIATE. One cron interval, plus GitHub's
 *      scheduling delay — measured on this estate at up to ~2h50m.
 *   4. IT PROVES A RUN EXISTED, NOT THAT THE RUN WAS HONEST. A workflow gutted
 *      to `run: "true"` still produces a run. Same class of limit as the
 *      deploy-drift check not observing production.
 *
 * ⚠️ REPORT-ONLY. NEVER A REQUIRED STATUS CHECK. Promoting this to a merge gate
 * would change the release process and is an amendment to ADR 0003 and ADR 0010,
 * which belongs in those ADRs and not in a check. See
 * ciSilence.reportOnlyNeverARequiredCheck.
 *
 * USAGE
 *   node scripts/ci-silence.mjs                 # in CI; reads GITHUB_REPOSITORY
 *   node scripts/ci-silence.mjs --repo owner/name
 *   node scripts/ci-silence.mjs --json
 *
 * ENVIRONMENT
 *   GITHUB_TOKEN      required. `actions: read` + `contents: read` is enough.
 *   GITHUB_REPOSITORY owner/name. Set automatically inside Actions.
 *   CI_SILENCE_DRILL  silent | blind — see THE DRILL below.
 */

import { appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadContract } from '../contracts/contract.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const API = 'https://api.github.com';

// ---------------------------------------------------------------------------
// The pure half — everything decidable without the network.
//
// Split out so src/__tests__/ci-silence.test.ts can drive every path off
// fixtures. The verdicts below are the whole contract of this script; the
// fetching underneath is plumbing.
// ---------------------------------------------------------------------------

/**
 * The first-parent chain from the branch tip, using only the commits on the page
 * we were given.
 *
 * ⚠️ IT STOPS AT THE EDGE OF THE PAGE RATHER THAN GUESSING. When a parent is not
 * in the fetched set the walk ends, so the answer is always a prefix of the true
 * chain — a floor on what is checked, never an invention. `lookbackDays` is
 * sized so the page reaches further back than the window in normal use, and a
 * short page means fewer commits examined, not wrong ones.
 */
export function firstParentChain(commits) {
  if (!Array.isArray(commits) || commits.length === 0) return [];
  const bySha = new Map(commits.map((c) => [c.sha, c]));
  const chain = [];
  const seen = new Set();
  let cursor = commits[0];
  while (cursor && !seen.has(cursor.sha)) {
    seen.add(cursor.sha);
    chain.push(cursor);
    const firstParent = cursor.parents?.[0]?.sha;
    cursor = firstParent ? bySha.get(firstParent) : undefined;
  }
  return chain;
}

/**
 * ⚠️ THE DRILL. `CI_SILENCE_DRILL` makes the condition this check exists to
 * catch actually true, so the failure path is exercised against the REAL API
 * rather than asserted about in a comment.
 *
 *   silent — the run belonging to the OLDEST in-window commit is removed, so one
 *            commit reads as validated by nothing while the rest stay healthy.
 *            That is the 2026-08-06 shape exactly: two pushes lost out of many.
 *   blind  — the commit list is rewritten to empty, exercising the "I could not
 *            enumerate the branch" path, which MUST fail rather than pass green.
 *
 * ⚠️ Both force the CONDITION true rather than moving a threshold, for the same
 * reason DEPLOY_DRIFT_DRILL does: on a healthy repo every commit has a run, so a
 * threshold-moving drill would have nothing to act on and would pass green — and
 * a drill that cannot fail is the bug it exists to catch, one level up.
 *
 * Touches no secret, mutates nothing, and is a `workflow_dispatch` input on
 * watchdog.yml, so it is safe to run at any time.
 */
export function applyDrill(observation, drill, now = new Date()) {
  if (drill === 'blind') return { ...observation, commits: null };
  if (drill === 'silent') {
    // The oldest commit INSIDE the window: the oldest on the page can sit just
    // past lookbackDays, where removing its run would change nothing and the
    // drill would pass green.
    const { declared } = observation;
    const chain = firstParentChain(observation.commits ?? []);
    const inWindow = declared ? eligibleCommits(chain, declared.graceHours, declared.lookbackDays, now) : [];
    const oldest = inWindow[inWindow.length - 1] ?? chain[chain.length - 1];
    if (!oldest) return observation;
    const runShas = new Set(observation.runShas ?? []);
    runShas.delete(oldest.sha);
    // drilledSha is still looked up against the real API by observe(), and the
    // answer is thrown away — so the drill exercises the confirmation path too.
    return { ...observation, runShas: [...runShas], drilledSha: oldest.sha };
  }
  return observation;
}

/** The committer date of a commit, as milliseconds. */
function committedAt(commit) {
  const iso = commit?.commit?.committer?.date ?? commit?.commit?.author?.date;
  return iso ? new Date(iso).getTime() : NaN;
}

/**
 * The commits of a first-parent chain that are old enough that a run should
 * exist by now, and young enough to be inside the window we claim to watch.
 * The grace end is load-bearing: without it every push goes red for the
 * seconds between the commit landing and the run being recorded.
 */
export function eligibleCommits(chain, graceHours, lookbackDays, now) {
  const graceMs = graceHours * HOUR_MS;
  const windowMs = lookbackDays * DAY_MS;
  return chain.filter((c) => {
    const t = committedAt(c);
    if (Number.isNaN(t)) return false;
    const age = now.getTime() - t;
    return age >= graceMs && age <= windowMs;
  });
}

/**
 * Whether a run from a per-commit lookup is a run of this workflow, on this
 * branch, for THIS commit. The sha is checked here too because the API ignores
 * an empty or unrecognised `head_sha` filter and returns every run.
 */
export function isRunOf(run, declared, sha) {
  return (
    run?.head_sha === sha &&
    String(run.path ?? '').split('@')[0] === `.github/workflows/${declared.file}` &&
    run.head_branch === declared.branch
  );
}

/**
 * One release branch, one verdict. `null` for `commits` means the branch could
 * not be enumerated; `null` for `runShas` means the Actions API could not be
 * asked which commits were validated.
 *
 * ⚠️ NEITHER NULL IS ALLOWED TO PASS. "I could not look" and "everything is
 * fine" must never produce the same output — that is this check's own failure
 * mode, one level up.
 */
export function evaluate({
  declared,
  commits,
  runShas,
  confirmedShas = [],
  lookedUp = 0,
  notLookedUp = 0,
  graceHours,
  lookbackDays,
  now,
}) {
  const base = {
    repo: declared.repo,
    file: declared.file,
    branch: declared.branch,
    why: declared.why,
    graceHours,
    lookbackDays,
  };

  if (!commits) {
    return {
      ...base,
      ok: false,
      reason:
        `${declared.branch} could not be enumerated, so this check does not know which commits ` +
        `landed and refuses to imply that all of them were validated.`,
    };
  }

  if (!runShas) {
    return {
      ...base,
      ok: false,
      reason:
        `the Actions API returned no run list for ${declared.file}, so this check cannot tell ` +
        `validated commits from unvalidated ones and refuses to guess.`,
    };
  }

  // A run found by EITHER the branch listing or a per-commit lookup validates a
  // commit. See observe() for why the listing alone is not trusted for absence.
  const validated = new Set([...runShas, ...confirmedShas]);
  const chain = firstParentChain(commits);
  const eligible = eligibleCommits(chain, graceHours, lookbackDays, now);

  const unvalidated = eligible.filter((c) => !validated.has(c.sha));

  const shared = {
    ...base,
    tip: chain[0]?.sha ?? null,
    chainLength: chain.length,
    eligible: eligible.length,
    lookedUp,
    notLookedUp,
    unvalidated: unvalidated.map((c) => ({
      sha: c.sha,
      committedAt: c.commit?.committer?.date ?? c.commit?.author?.date ?? null,
      ageDays: (now.getTime() - committedAt(c)) / DAY_MS,
    })),
  };

  if (unvalidated.length) {
    const oldest = shared.unvalidated[shared.unvalidated.length - 1];
    return {
      ...shared,
      ok: false,
      reason:
        `${unvalidated.length} commit(s) on ${declared.branch} have no ${declared.file} run at all — ` +
        `the oldest, ${oldest.sha.slice(0, 7)}, landed ${oldest.ageDays.toFixed(1)} days ago. ` +
        (notLookedUp
          ? `${notLookedUp} of them were NOT confirmed by a per-commit lookup (the bound of ` +
            `${MAX_LOOKUPS} was reached), so the branch listing may simply be stale — but this check ` +
            `refuses to call them validated without evidence. `
          : lookedUp
            ? `Each was confirmed absent by a per-commit lookup, not just the branch listing. `
            : '') +
        `${declared.why} A dropped push trigger looks exactly like this: no run, no failure, no ` +
        `email, nothing red. Re-run ${declared.file} against each commit from the Actions tab, and ` +
        `check https://www.githubstatus.com for an incident covering when they landed.`,
    };
  }

  if (eligible.length === 0) {
    // Not a pass by luck — say so, so a permanently empty window cannot read as
    // a healthy one. A repo with no commits in the window has nothing to check
    // and this check makes no claim about it.
    return {
      ...shared,
      ok: true,
      reason:
        `no commits on ${declared.branch} are inside the window (older than ${graceHours}h, ` +
        `younger than ${lookbackDays}d), so there is nothing to validate and nothing is claimed`,
    };
  }

  return {
    ...shared,
    ok: true,
    reason:
      `all ${eligible.length} commit(s) in the last ${lookbackDays}d have a ${declared.file} run` +
      (lookedUp ? ` (${lookedUp} missing from the branch listing, each found by a per-commit lookup)` : ''),
  };
}

/** Which declared release branches belong to the repo we are running in. */
export function branchesFor(contract, repoSlug) {
  const spec = contract.ciSilence;
  // The slugs live in scheduledWorkflows.githubRepos and are NOT duplicated
  // here — same reasoning as deployDrift.githubReposWhy. A second copy is a
  // second thing to forget when a repo is renamed.
  const slugs = contract.scheduledWorkflows.githubRepos;
  const key = Object.entries(slugs).find(([, slug]) => slug.toLowerCase() === repoSlug.toLowerCase())?.[0];
  return { key, branches: key ? spec.branches.filter((b) => b.repo === key) : [] };
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
      'user-agent': 'capucor-ci-silence',
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    // ⚠️ Never degrade to "assume it is fine". A silence check that answers "I
    // could not look" with a green tick is the exact bug it exists to catch, one
    // level up.
    fail(
      `GET ${path} returned ${res.status} ${res.statusText}. The CI-silence check could not read ` +
        `the GitHub API, so it does not know whether validation ran — and refuses to imply that it ` +
        `did. A 401/403 here is the token: the job needs \`actions: read\` and \`contents: read\`.`,
    );
  }
  return res.json();
}

/**
 * The most per-commit lookups one check makes. A first-parent chain over the
 * 14-day window has run to ~25 commits here; past the bound the rest are
 * reported unconfirmed (and still red), never assumed validated.
 */
export const MAX_LOOKUPS = 40;

/**
 * Reads the branch and its runs, then CONFIRMS every apparent gap with a
 * per-commit lookup before it may count. `get` is `(path) => json | null`,
 * injected so the tests can drive the stale-listing case off fixtures. The
 * drill is applied here, between the listing and the lookups, so a drilled run
 * still goes through the confirmation path against the real API.
 *
 * ⚠️ THE BRANCH LISTING IS NOT EVIDENCE OF ABSENCE. Measured 2026-10-07:
 * `ci.yml/runs?branch=master` returned nothing newer than 2026-08-06, so this
 * check reported 15 commits as unvalidated that each had a green push run —
 * plainly visible to `actions/runs?head_sha=<sha>`. A run either listing
 * returns is real, so the listing still clears most commits in one call; only
 * a commit it does NOT clear costs a lookup, and only a commit both miss is
 * reported.
 */
export async function observe(declared, repoSlug, get, { drill = '', now = new Date() } = {}) {
  const since = new Date(now.getTime() - (declared.lookbackDays + 1) * DAY_MS).toISOString();

  // One page each. `per_page=100` reaches further back than any lookbackDays we
  // set, and firstParentChain stops at the edge of the page rather than guessing
  // past it, so a short page narrows what is checked and never widens it.
  const [commits, runs] = await Promise.all([
    get(`/repos/${repoSlug}/commits?sha=${declared.branch}&since=${since}&per_page=100`),
    get(
      `/repos/${repoSlug}/actions/workflows/${declared.file}/runs` +
        `?branch=${declared.branch}&per_page=100&exclude_pull_requests=true`,
    ),
  ]);

  const observation = applyDrill(
    {
      declared,
      commits: Array.isArray(commits) ? commits : null,
      runShas: runs?.workflow_runs ? runs.workflow_runs.map((r) => r.head_sha) : null,
    },
    drill,
    now,
  );
  if (!observation.commits || !observation.runShas) return observation;

  const listed = new Set(observation.runShas);
  const suspects = eligibleCommits(
    firstParentChain(observation.commits),
    declared.graceHours,
    declared.lookbackDays,
    now,
  ).filter((c) => !listed.has(c.sha));
  const toLookUp = suspects.slice(0, MAX_LOOKUPS);

  const confirmedShas = [];
  for (const c of toLookUp) {
    const found = await get(`/repos/${repoSlug}/actions/runs?head_sha=${c.sha}&per_page=100&exclude_pull_requests=true`);
    if ((found?.workflow_runs ?? []).some((r) => isRunOf(r, declared, c.sha)) && c.sha !== observation.drilledSha) {
      confirmedShas.push(c.sha);
    }
  }

  return { ...observation, confirmedShas, lookedUp: toLookUp.length, notLookedUp: suspects.length - toLookUp.length };
}

// ---------------------------------------------------------------------------
// CLI — guarded so the exports above stay importable from Vitest.
// ---------------------------------------------------------------------------

const isCli = process.argv[1] && process.argv[1].split(/[\\/]/).pop() === 'ci-silence.mjs';

if (isCli) {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const repoArg = args.indexOf('--repo');
  const repoSlug = repoArg !== -1 ? args[repoArg + 1] : process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const drill = process.env.CI_SILENCE_DRILL || '';

  if (!repoSlug) {
    fail('No repository. Set GITHUB_REPOSITORY (Actions does this) or pass --repo owner/name.');
  }
  if (!token) {
    // Deliberately NOT a skip, for the same reason the cron watchdog and the
    // drift check refuse to skip: "the token is gone" and "CI has not run for a
    // fortnight" produce the same silence.
    fail(
      'GITHUB_TOKEN is not set, so the CI-silence check cannot see the GitHub API. It refuses to ' +
        'skip: a check that silently stops checking is the failure it exists to catch.',
    );
  }

  const contract = loadContract(join(HERE, '..', 'contracts'));
  const { key, branches } = branchesFor(contract, repoSlug);

  if (!key) {
    fail(
      `${repoSlug} is not in scheduledWorkflows.githubRepos in the contract manifest, so the ` +
        `CI-silence check does not know which branch to expect here. Declare it in ` +
        `contracts/web-contract.json.`,
    );
  }
  if (!branches.length) {
    fail(`The contract declares no release branches for ${repoSlug}, but this check is wired up here.`);
  }

  if (drill) {
    console.log(`🔥 CI_SILENCE_DRILL=${drill} — forcing the failure path on purpose.`);
    console.log('   This run MUST go red. A green run here means the check is not gating.\n');
  }

  const now = new Date();
  const results = [];
  for (const declared of branches) {
    const observation = await observe(declared, repoSlug, (path) => gh(path, token), { drill, now });
    results.push(
      evaluate({
        ...observation,
        graceHours: declared.graceHours,
        lookbackDays: declared.lookbackDays,
        now,
      }),
    );
  }

  const broken = results.filter((r) => !r.ok);

  if (asJson) {
    console.log(JSON.stringify({ ok: broken.length === 0, repo: repoSlug, results }, null, 2));
  } else {
    console.log(`CI-silence check — ${repoSlug}\n`);
    for (const r of results) {
      console.log(`${r.ok ? '✓' : '✗'} ${`${r.file}@${r.branch}`.padEnd(20)} ${r.reason}`);
      for (const c of r.unvalidated ?? []) {
        console.log(`  ↳ ${c.sha.slice(0, 7)} ${c.committedAt} — no run`);
      }
    }
    console.log('');
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      [
        `### CI-silence check — ${repoSlug}`,
        '',
        '| Workflow | Branch | Commits checked | Unvalidated | |',
        '|---|---|---|---|---|',
        ...results.map(
          (r) =>
            `| \`${r.file}\` | \`${r.branch}\` | ${r.eligible ?? '—'} ` +
            `| ${r.unvalidated ? r.unvalidated.length : '—'} | ${r.ok ? '✅' : '❌'} |`,
        ),
        '',
        broken.length
          ? '❌ Commits landed on the release branch that validation never ran on. A dropped push trigger produces no run, no failure and no email.'
          : '✅ Every commit in the window has a validation run.',
        '',
        'This check runs on the SCHEDULE, not the push, because the push path is the one that goes',
        'missing. It asks whether validation RAN, not whether it passed.',
        '',
      ].join('\n'),
    );
  }

  if (broken.length) {
    for (const r of broken) console.error(`::error::${r.file}@${r.branch}: ${r.reason}`);
    console.error(
      `\n${broken.length} of ${results.length} release branch(es) carry commits validation never ran on. ` +
        `See ciSilence in contracts/web-contract.json.`,
    );
    process.exitCode = 1;
  } else {
    console.log(`All ${results.length} declared release branch(es) are fully validated inside the window.`);
  }
}
