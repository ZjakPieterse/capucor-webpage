#!/usr/bin/env node
/**
 * The deploy-drift check. Asks one question per surface: IS PRODUCTION STILL
 * THE TIP OF THE BRANCH, AND IF NOT, HOW LONG HAS THAT BEEN TRUE?
 *
 * WHY THIS EXISTS. Risk R-12. Nothing watched `master` drifting ahead of what
 * is actually deployed. On 2026-08-24 capucor-os drifted by two merges before
 * being closed by hand, and the same day capucor-webpage was measured four days
 * and TWENTY-ONE commits behind its last successful production deploy — the
 * Node 24 Actions upgrade and four `db.ts` regenerations among them — with no
 * signal anywhere. ADR 0010 part 1 is why this now matters more, not less:
 * deployment is a manual dispatch on both surfaces, so `master` ahead of
 * production is the NORMAL state, a merged fix is no longer a shipped fix, and
 * drift no longer self-corrects.
 *
 * ⚠️ THE OBVIOUS SHAPE IS WRONG. The cron watchdog in the file beside this one
 * asks "when did the workflow last succeed?". That question does not transfer.
 * A deploy is not scheduled and has no cadence it is meant to keep, so an age
 * threshold on the WORKFLOW invents a release cadence ADR 0010 deliberately
 * declined to set — and it is reset by a deploy that happened for an unrelated
 * reason while the drift that matters persists. The question here is a
 * COMPARISON: take the `head_sha` of the newest SUCCESSFUL deploy run and
 * compare it to the tip of the release branch.
 *
 * ⚠️ AND IT IS NOT AN EQUALITY CHECK. Under ADR 0010, ahead-of-production is
 * normal, so failing whenever the deployed SHA is not the tip goes red on every
 * merge — and a gate that cries wolf is a gate somebody switches off. The
 * threshold is the AGE OF THE OLDEST UNSHIPPED COMMIT, never `ahead_by`.
 * Commit count is noise: twenty-one commits of generated types is not riskier
 * than one broken route. Age measures the thing that actually went wrong — how
 * long a merged fix has not been a shipped fix. `ahead_by` is reported as
 * context and must never become a threshold.
 *
 * WHAT IT CANNOT DO, stated rather than implied.
 *
 *   1. IT DOES NOT OBSERVE PRODUCTION. A green deploy run proves `wrangler`
 *      uploaded a build; it does not prove the Worker is serving that code. A
 *      Cloudflare dashboard rollback, a hand-run `npx wrangler deploy` from a
 *      laptop, or a deploy against the wrong account are all invisible here.
 *      Ground truth would need the deployed app to advertise its build SHA and
 *      this job to fetch it — but detailed /api/health is HMAC-signed with
 *      SUPABASE_SERVICE_ROLE_KEY, and putting a production secret into a job
 *      that runs on EVERY push is a worse trade than the gap it closes.
 *   2. IT CANNOT FIRE DURING QUIET. Same limit as the cron watchdog, sharper
 *      here, because a push is the very thing that CREATES drift. A repo that
 *      goes quiet while drifted stays silent until someone pushes again.
 *   3. IT CANNOT JUDGE WHETHER THE DRIFT MATTERS. Generated types and a broken
 *      route look identical from here. It reports; a human reads the commits.
 *   4. IT CLOSES HALF OF R-12. The risk also records CI SILENCE — the
 *      2026-08-06 incident where GitHub dropped push triggers so ci.yml never
 *      ran at all. This does not detect that, and the detector would be
 *      self-referential: if push triggers are dropped, the workflow hosting
 *      this step is not running either. R-12a is this; R-12b stays open.
 *
 * ZERO DEPENDENCIES, on purpose, and it runs as a second STEP inside
 * watchdog.yml rather than as its own workflow: same push trigger, same reason
 * (a push is the one moment we know a human is present), and the permissions
 * are already granted there — `actions: read` for the run, `contents: read` for
 * the compare. No new workflow, no new credential, no extra Actions minutes.
 *
 * USAGE
 *   node scripts/deploy-drift.mjs                 # in CI; reads GITHUB_REPOSITORY
 *   node scripts/deploy-drift.mjs --repo owner/name
 *   node scripts/deploy-drift.mjs --json
 *
 * ENVIRONMENT
 *   GITHUB_TOKEN       required. `actions: read` + `contents: read` is enough.
 *   GITHUB_REPOSITORY  owner/name. Set automatically inside Actions.
 *   DEPLOY_DRIFT_DRILL drift | never — see THE DRILL below.
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
// Split out so src/__tests__/deploy-drift.test.ts can drive every path off
// fixtures. The verdicts below are the whole contract of this script; the
// fetching underneath is plumbing.
// ---------------------------------------------------------------------------

/**
 * ⚠️ THE DRILL. `DEPLOY_DRIFT_DRILL` makes the condition this check exists to
 * catch actually true, so the failure path can be exercised on demand against
 * the REAL API rather than being asserted about in a comment.
 *
 *   drift — the observed comparison is rewritten to 99 commits ahead with an
 *           oldest unshipped commit 99 days old. Exercises the common case and
 *           the message a future reader has to act on.
 *   never — the observed run is rewritten to absent, exercising the "this repo
 *           has never deployed" path.
 *
 * ⚠️ It forces the CONDITION true rather than moving the threshold, which is
 * where this differs from SCHEDULE_WATCHDOG_DRILL=stale. With the deployed SHA
 * at the tip there is no unshipped commit at all, so a threshold of zero would
 * have nothing to act on and the drill would pass green — a drill that cannot
 * fail is the bug it exists to catch, one level up.
 *
 * Touches no secret, mutates nothing, and is a `workflow_dispatch` input on
 * watchdog.yml, so it is safe to run at any time.
 */
export function applyDrill(observation, drill) {
  if (drill === 'never') return { ...observation, run: null, comparison: null };
  if (drill === 'drift') {
    const oldest = new Date(Date.now() - 99 * DAY_MS).toISOString();
    return {
      ...observation,
      comparison: {
        status: 'ahead',
        ahead_by: 99,
        behind_by: 0,
        commits: [{ sha: '0'.repeat(40), commit: { committer: { date: oldest } } }],
      },
    };
  }
  return observation;
}

/**
 * One deployment surface, one verdict. `null` for `run` means the Actions API
 * knows of no successful run of that deploy workflow; `null` for `comparison`
 * means the compare call could not resolve one of the two ends.
 *
 * ⚠️ A NON-BRANCH DEPLOY IS REPORTED, NOT FAILED ON. Shipping a hotfix from a
 * branch is legitimate, and the comparison below still tells the truth about
 * where production sits relative to the release branch regardless of which ref
 * the dispatch named. Failing on it would punish the one situation where
 * somebody is already dealing with an incident.
 */
export function evaluate({ declared, run, comparison, maxAgeDays, now }) {
  const base = {
    repo: declared.repo,
    file: declared.file,
    branch: declared.branch,
    why: declared.why,
    maxAgeDays,
  };

  if (!run) {
    return {
      ...base,
      ok: false,
      reason:
        `${declared.file} has never completed a successful run. Either this surface has never been ` +
        `deployed through it, or every attempt has failed — both mean nothing is known about what ` +
        `production is actually serving, and nothing else was going to say so.`,
    };
  }

  const shared = {
    ...base,
    deployedSha: run.head_sha,
    deployedAt: run.updated_at,
    deployedFrom: run.head_branch ?? null,
    url: run.html_url ?? null,
  };

  if (!comparison) {
    return {
      ...shared,
      ok: false,
      reason:
        `the last successful deploy shipped ${String(run.head_sha).slice(0, 7)}, and GitHub can no ` +
        `longer compare that commit to ${declared.branch}. The commit has been removed from the ` +
        `repository — a force-push or a rewritten history — so what is deployed is not a commit ` +
        `anybody can now read.`,
    };
  }

  const ctx = { ...shared, status: comparison.status, aheadBy: comparison.ahead_by, behindBy: comparison.behind_by };

  if (comparison.status === 'identical') {
    return { ...ctx, ageDays: 0, ok: true, reason: `production is at the tip of ${declared.branch}` };
  }

  if (comparison.status !== 'ahead') {
    // `behind` means the branch is behind what was deployed; `diverged` means
    // both moved. Either way production is serving something that is not on the
    // release branch, which no threshold should be allowed to excuse.
    return {
      ...ctx,
      ok: false,
      reason:
        `production is serving ${String(run.head_sha).slice(0, 7)}, which is "${comparison.status}" ` +
        `relative to ${declared.branch} (${comparison.ahead_by} ahead, ${comparison.behind_by} behind). ` +
        `Deployed code that is not on the release branch cannot be reviewed, reverted or reasoned ` +
        `about from the branch.`,
    };
  }

  // `commits` is oldest-first, so [0] is the first commit that never shipped.
  // GitHub caps the list at 250; past that the oldest available is still the
  // oldest on the page, so the age is a floor rather than an overestimate. The
  // fallback to the deploy time is deliberately the more conservative of the
  // two readings when the list comes back empty.
  const oldest = comparison.commits?.[0]?.commit?.committer?.date ?? run.updated_at;
  const ageDays = (now.getTime() - new Date(oldest).getTime()) / DAY_MS;
  const withAge = { ...ctx, ageDays, oldestUnshipped: oldest };

  if (ageDays > maxAgeDays) {
    return {
      ...withAge,
      ok: false,
      reason:
        `${comparison.ahead_by} commit(s) on ${declared.branch} have never been deployed, and the ` +
        `oldest has been waiting ${ageDays.toFixed(1)} days — the contract allows ${maxAgeDays}. ` +
        `${declared.why} Dispatch ${declared.file}, or decide deliberately that these commits are ` +
        `not going out and say so.`,
    };
  }

  return {
    ...withAge,
    ok: true,
    reason:
      `${comparison.ahead_by} commit(s) not yet deployed, oldest ${ageDays.toFixed(1)} days ` +
      `(limit ${maxAgeDays})`,
  };
}

/** Which declared deployment surfaces belong to the repo we are running in. */
export function deploymentsFor(contract, repoSlug) {
  const spec = contract.deployDrift;
  // The slugs live in scheduledWorkflows.githubRepos and are NOT duplicated
  // here — see deployDrift.githubReposWhy. A second copy is a second thing to
  // forget when a repo is renamed.
  const slugs = contract.scheduledWorkflows.githubRepos;
  const key = Object.entries(slugs).find(([, slug]) => slug.toLowerCase() === repoSlug.toLowerCase())?.[0];
  return { key, deployments: key ? spec.deployments.filter((d) => d.repo === key) : [] };
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
      'user-agent': 'capucor-deploy-drift',
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    // ⚠️ Never degrade to "assume it is fine". A drift check that answers "I
    // could not look" with a green tick is the exact bug it exists to catch,
    // one level up.
    fail(
      `GET ${path} returned ${res.status} ${res.statusText}. The deploy-drift check could not read ` +
        `the GitHub API, so it does not know what production is serving — and refuses to imply that ` +
        `it is current. A 401/403 here is the token: the job needs \`actions: read\` and ` +
        `\`contents: read\`.`,
    );
  }
  return res.json();
}

async function observe(declared, repoSlug, token) {
  const runs = await gh(
    `/repos/${repoSlug}/actions/workflows/${declared.file}/runs?status=success&per_page=1&exclude_pull_requests=true`,
    token,
  );
  const run = runs?.workflow_runs?.[0] ?? null;
  if (!run) return { declared, run: null, comparison: null };

  const comparison = await gh(`/repos/${repoSlug}/compare/${run.head_sha}...${declared.branch}`, token);
  return { declared, run, comparison };
}

// ---------------------------------------------------------------------------
// CLI — guarded so the exports above stay importable from Vitest.
// ---------------------------------------------------------------------------

const isCli = process.argv[1] && process.argv[1].split(/[\\/]/).pop() === 'deploy-drift.mjs';

if (isCli) {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const repoArg = args.indexOf('--repo');
  const repoSlug = repoArg !== -1 ? args[repoArg + 1] : process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const drill = process.env.DEPLOY_DRIFT_DRILL || '';

  if (!repoSlug) {
    fail('No repository. Set GITHUB_REPOSITORY (Actions does this) or pass --repo owner/name.');
  }
  if (!token) {
    // Deliberately NOT a skip, for the same reason the cron watchdog refuses to
    // skip: "the token is gone" and "production is six weeks behind" produce
    // the same silence.
    fail(
      'GITHUB_TOKEN is not set, so the deploy-drift check cannot see the GitHub API. It refuses to ' +
        'skip: a check that silently stops checking is the failure it exists to catch.',
    );
  }

  const contract = loadContract(join(HERE, '..', 'contracts'));
  const { key, deployments } = deploymentsFor(contract, repoSlug);

  if (!key) {
    fail(
      `${repoSlug} is not in scheduledWorkflows.githubRepos in the contract manifest, so the ` +
        `deploy-drift check does not know which surface to expect here. Declare it in ` +
        `capucor-docs/contracts/cross-repo-contract.json and copy it into both app repos.`,
    );
  }
  if (!deployments.length) {
    fail(`The contract declares no deployment surfaces for ${repoSlug}, but this check is wired up here.`);
  }

  if (drill) {
    console.log(`🔥 DEPLOY_DRIFT_DRILL=${drill} — forcing the failure path on purpose.`);
    console.log('   This run MUST go red. A green run here means the check is not gating.\n');
  }

  const now = new Date();
  const results = [];
  for (const declared of deployments) {
    const observation = await observe(declared, repoSlug, token);
    const drilled = applyDrill(observation, drill);
    results.push(evaluate({ ...drilled, maxAgeDays: declared.maxAgeDays, now }));
  }

  const broken = results.filter((r) => !r.ok);

  if (asJson) {
    console.log(JSON.stringify({ ok: broken.length === 0, repo: repoSlug, results }, null, 2));
  } else {
    console.log(`Deploy-drift check — ${repoSlug}\n`);
    for (const r of results) {
      console.log(`${r.ok ? '✓' : '✗'} ${r.file.padEnd(20)} ${r.reason}`);
      if (r.deployedFrom && r.deployedFrom !== r.branch) {
        console.log(`  ↳ note: that deploy was dispatched against "${r.deployedFrom}", not ${r.branch}.`);
      }
    }
    console.log('');
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      [
        `### Deploy-drift check — ${repoSlug}`,
        '',
        '| Workflow | Deployed | Ahead by | Oldest unshipped | Limit | |',
        '|---|---|---|---|---|---|',
        ...results.map(
          (r) =>
            `| \`${r.file}\` | ${r.deployedSha ? `\`${r.deployedSha.slice(0, 7)}\`` : '—'} ` +
            `| ${r.aheadBy ?? '—'} | ${r.ageDays === undefined ? '—' : `${r.ageDays.toFixed(1)}d`} ` +
            `| ${r.maxAgeDays}d | ${r.ok ? '✅' : '❌'} |`,
        ),
        '',
        broken.length
          ? '❌ Production is behind the release branch by more than the contract allows. A merged fix is not a shipped fix.'
          : '✅ Every declared surface is deployed inside its window.',
        '',
        'This check reads the Actions API only. It does NOT observe production: a green row means a',
        'deploy run succeeded on that commit, not that the Worker is serving it.',
        '',
      ].join('\n'),
    );
  }

  if (broken.length) {
    for (const r of broken) console.error(`::error::${r.file}: ${r.reason}`);
    console.error(
      `\n${broken.length} of ${results.length} deployment surface(s) are behind the release branch. ` +
        `See deployDrift in contracts/cross-repo-contract.json.`,
    );
    process.exitCode = 1;
  } else {
    console.log(`All ${results.length} declared deployment surface(s) are current within their window.`);
  }
}
