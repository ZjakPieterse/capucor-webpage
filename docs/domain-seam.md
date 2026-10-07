# The domain seam, and the operational rules that sit on it

> capucor.com (this repo) and capucor.app (`capucor-os`) are two domains, two repositories and two Cloudflare Workers. This page is everything this repo still has to know about that boundary — **plus four operational contracts that were filed under it**: the web contract manifest, the scheduled-workflow watchdog, the request-body caps, and the email delivery adapter.
>
> Since web-standalone phase 3 (2026-10-07) **signing stops at `signed` + the signed PDF in Drive**: nothing in this repo writes a capucor.app portal table, and failed sends are retried from this repo.
>
> Extracted from `AGENTS.md` on 2026-09-03 (EH-02); the words are unchanged.
>
> Canonical agent instructions: [`../AGENTS.md`](../AGENTS.md).

---

## Domain seam — capucor.com vs capucor.app

**Two domains, two repos, two Cloudflare Workers.** This repo is capucor.com only.

| Domain | Repo | Worker | Owns |
|--------|------|--------|------|
| **capucor.com** + www | **this one** (`capucor-webpage`) | `capucor-web` | Marketing + the whole sales funnel: `/`, service pages, `/pricing`, `/privacy`, `/terms/*`, `/resources/*`, **and `/proposal/*`** (the signing document). Indexable — all canonicals, sitemap, OG |
| **capucor.app** + www | [`../capucor-os`](../../capucor-os/AGENTS.md) | `capucor-os` | **Capucor OS**: `/login`, `/onboarding`, `/portal/*`, `/internal/*`. `noindex` on every response |

> **Working on the portal, `/internal`, login, or anything a signed-in user sees?
> Wrong repo — go to [`../capucor-os/AGENTS.md`](../../capucor-os/AGENTS.md).** None of that code is
> here any more; it was deleted in Phase 3 of the OS split (2026-08-02, `ac91b75`) and git history
> keeps it. What went, what stayed and why is in
> [`../capucor-docs/archive/capucor-web-phase-history.md`](../../capucor-docs/archive/capucor-web-phase-history.md).

### What is left of the seam in this repo

The redirect table in `next.config.ts` is now **one-directional and half its former size**: someone
asks capucor.com for an OS path, we bounce them to capucor.app. That is all.

- **`APP_PATHS`** — `/portal`, `/internal`, `/login`, `/onboarding` (+ sub-paths). These routes do
  not exist here at all; the redirect is the only thing between an old bookmark and a 404.
- **`www.capucor.com` → apex.**
- **`/client-portal`** — a legacy public path, absolute to capucor.app.

**The capucor.app→capucor.com half now lives in the other repo, and so does the `noindex` header
rule.** `MARKETING_PATHS` is gone from here. Do not re-add either: this Worker never answers on
capucor.app, so a rule here could not fire, and editing it here would not change capucor.app's
behaviour. ⚠️ **Adding a new public page no longer needs a `MARKETING_PATHS` entry** — but
`/proposal/:path*` **does** still need to stay in *capucor-os*'s table, because proposal links in
already-sent emails were minted against capucor.app.

### Rules that still hold

- **`siteConfig.url` does not exist.** Use `siteConfig.marketingUrl` or `siteConfig.appUrl`
  (`src/config/site.ts`, overridable via `NEXT_PUBLIC_MARKETING_URL` / `NEXT_PUBLIC_APP_URL`).
  **Both URLs are still needed here.** `appUrl` has one live consumer, the Navbar's Client
  Portal CTA (plus the redirect table). Since phase 3 no email or signing page links capucor.app;
  they say Zjak will be in touch.
- **Links that cross domains must be absolute.** Everything pointing at capucor.app is now a
  cross-repo link — it can never be a relative route.
- **Auth lives on capucor.app because a Supabase session cookie set on one eTLD+1 is unreachable
  from the other.** The two domains can never share a login. That constraint is why the split fell
  the way it did, and it does not change.
- **Never add an `/api/*` host redirect.** A 301 on a POST downgrades it to GET and drops the body.
  This repo's API is single-host now, so there is nothing to route — but the trap is still there
  for anyone who adds a rule later.
- **The funnel stays here in full**, including `/proposal/*`, `/api/proposals/sign*`, the signed
  PDF and the retry runner. Signing gives no capucor.app access (phase 3) — see the schema seam
  below.

`wrangler dev` **does not run on the Windows dev box** (wrangler 4.84 dies with
`std::terminate()` on a bundle that deploys fine), so the old local host-faking recipe is
unavailable. Verify the table with `curl -sI` against the deployed Worker instead:

```bash
curl -sI https://capucor.com/portal      # 308 → https://capucor.app/portal
curl -sI https://capucor.com/login       # 308 → https://capucor.app/login
curl -sI https://www.capucor.com/pricing # 308 → https://capucor.com/pricing
curl -sI https://capucor.com/pricing     # 200 — never redirected
```

### Schema seam — what is left

Since 2026-10-07 **this repo owns the funnel schema** ([`database.md`](database.md)), and since
web-standalone phase 3 (migration `001`) **signing writes no portal table**: fulfilment is
pdf → client email → owner email, and `provision_from_signed_proposal` is gone. What still crosses
the line until os-sunset is listed under "Links across the line" in [`database.md`](database.md):
`proposals.client_org_id` (unused), the shared `email_deliveries` table, `set_updated_at()` and
the staff read policy on `proposals`. A capucor-os change to a portal table can no longer break
signing here.

### The web contract — `contracts/web-contract.json`

Since 2026-10-07 (web-standalone phase 2) this repo's invariants live in one **web-owned** manifest,
checked by `npm test` (`src/__tests__/web-contract.test.ts` plus the three watchdog tests). It
replaced the cross-repo contract shared with capucor-os and capucor-docs; nothing in it is compared
with another repository, and `npm run audit` in capucor-os no longer covers this repo.

- **Exact pins** — Next, `@opennextjs/cloudflare` and Wrangler move together; React,
  supabase-js and resend are pinned exact too; Node matches in `.nvmrc` and `ci.yml`.
- **Redirect table** — `APP_PATHS` keeps its entries; no redirect from `/api`, `/_next` or
  `/brand`.
- **Written rules** — `AGENTS.md` and `docs/database.md` say no agent applies a migration;
  `AGENTS.md` and `docs/deploy.md` say production deploys by manual dispatch.
- **Schema ownership** — the funnel baseline exists and its first statement raises.
- **Watchdogs** — the declared crons, deploy surface and release branch (next section).

`src/lib/pricing.ts`, `src/lib/proposalPricing.ts`, `src/config/tiers.ts`,
`src/lib/email/messages.mjs` and `src/types/db.ts` are this repo's own files; change them here
only. capucor-os keeps its old copies, which are not kept in step.

### Scheduled workflows and the watchdog

This repo runs three scheduled workflows — the POPIA lead prune, the proposal expiry and the
fulfilment/email retry runner (`cron-reconcile-deliveries.yml`, see the email section below) — and
`.github/workflows/watchdog.yml` checks on every push that each one is still succeeding, via
`scripts/schedule-watchdog.mjs`.

- The script selects this repo's crons by matching `GITHUB_REPOSITORY` against
  `scheduledWorkflows.githubRepos` in `contracts/web-contract.json`; the same manifest declares
  the deploy surface (`deployDrift`) and release branch (`ciSilence`) the other two steps check.
- ⚠️ **A new cron must be declared in `scheduledWorkflows`**, or `schedule-watchdog.test.ts`
  fails — an undeclared cron is a job nothing watches.
- **Zero dependencies and `actions: read` only.** Keep it that way; the watchdog tests fail if
  `npm ci` appears in that workflow.
- `SCHEDULE_WATCHDOG_DRILL` (`stale` / `disabled`) is a `workflow_dispatch` input that forces the
  failure path against the real API. Re-run it after changing the script or the workflow.

⚠️ **Why this watchdog exists, and what it deliberately cannot cover:**
[`../capucor-os/docs/engineering/prototype/CAPUCOR_WEB_SEAMS.md`](../../capucor-os/docs/engineering/prototype/CAPUCOR_WEB_SEAMS.md).

### Cloudflare

capucor.com + www are bound to the `capucor-web` Worker; capucor.app + www to `capucor-os`. The
bindings are managed in the dashboard, not in `wrangler.jsonc` (which declares no `routes`), so a
deploy from either repo cannot claim the other's hostname.

⚠️ **Never delete the capucor.com zone or any of its DNS records.** Several are load-bearing for
services beyond this website, and removing them breaks those services silently while the sites keep
looking fine. Which records, and what each one carries:
[`../capucor-os/docs/engineering/prototype/CAPUCOR_WEB_SEAMS.md`](../../capucor-os/docs/engineering/prototype/CAPUCOR_WEB_SEAMS.md).

### Request bodies are capped — never call `req.json()` in a route handler

**Read the body with `readJsonBody(req, MAX_BODY_BYTES)`** from
[`src/lib/readJsonBody.ts`](../src/lib/readJsonBody.ts), with a per-route `MAX_BODY_BYTES` constant
beside the route's `RATE_LIMIT_KEY`. All six body-reading routes here do.

⚠️ **`await req.json()` is unbounded — never introduce it in a route handler.**
`route-body-bounds.test.ts` pins the behaviour, including that the refusal happens before any
Supabase or email work. Routes that read **no** body need no cap; don't add one for symmetry.

⚠️ **`/api/proposals/sign` has three nested bounds and the order is deliberate.** Read the reasoning
before changing any of them — getting the order wrong degrades a real signer's error message.

The measurements behind these bounds, and why the nesting order matters:
[`../capucor-os/docs/engineering/prototype/CAPUCOR_WEB_SEAMS.md`](../../capucor-os/docs/engineering/prototype/CAPUCOR_WEB_SEAMS.md).

### Email delivery contract

Every transactional send in the Worker goes through [`src/lib/email/sendEmail.ts`](../src/lib/email/sendEmail.ts).
Do not construct `Resend` or call `resend.emails.send()` anywhere else; the retry runner below is
the only other sender, and it follows the same contract. The adapter requires a
stable business-event idempotency key, bounds the provider call, checks both returned errors and
thrown failures, and returns `accepted` only with a provider message id. `accepted` means the
provider accepted the API request, not that the recipient opened or even received it. Never log a
link token or idempotency key, and never write a sent timestamp from a `pending` result.

The adapter persists one `email_deliveries` row **before** calling Resend, claims it with a
60-second lease, and passes the same globally unique key to the provider. Returned errors, thrown
transport failures, timeouts and missing provider configuration become `retry_scheduled`; repeated
or concurrent requests load the existing event instead of creating another provider message. A
stale processing lease is reclaimable with the same provider key. Callers must supply a UUID source
(`lead`, `data_request` or `proposal`) and a dotted event type;
store no subject, body, snippet, recipient link token or other message content in the operational
table.

**Retries run in this repo** (since web-standalone phase 3, 2026-10-07; capucor-os's
reconciliation workflow did this before and is disabled).
[`cron-reconcile-deliveries.yml`](../.github/workflows/cron-reconcile-deliveries.yml) runs
[`scripts/reconcile-deliveries.mjs`](../scripts/reconcile-deliveries.mjs) every ten minutes in
weekday business hours and hourly otherwise. It is a zero-dependency GitHub Action, not a Worker
route, because Workers Free allows 10 ms CPU and 50 subrequests per request.

- It first advances due signed-proposal fulfilment (pdf → client email → owner email). The PDF is
  rendered by the Worker: the runner calls `/api/internal/proposal-fulfilment/pdf` with an HMAC
  over `timestamp.proposalId` keyed by the service-role key
  (`src/lib/portal/reconciliationAuth.ts`), so the Apps Script secret never leaves the Worker.
- It then resends due deliveries of this repo's sources only (`lead`, `data_request`,
  `proposal`), rebuilding each message from its source row through the dependency-free
  [`src/lib/email/messages.mjs`](../src/lib/email/messages.mjs) and reusing the ORIGINAL
  idempotency key. The two "signed" emails are built whole there
  (`buildSignedClientMessage` / `buildSignedOwnerMessage`), so the Worker's first attempt and a
  retry send the same request; `reconcile-deliveries.test.ts` checks it.
- Six attempts, then `permanently_failed`; an ambiguous attempt older than 23 hours (outside
  Resend's 24-hour idempotency window) also fails permanently rather than risk a duplicate.
- A run fails only for what **that run** failed permanently (GitHub then emails); older permanent
  failures are listed as warnings, so one stuck row cannot keep the job red and make the watchdog
  read it as stale.
- ⚠️ **This repository is public, so the runner's logs are public.** It logs ids, event types,
  counts and error codes only — never a recipient, a link token, a message body or a provider
  error message. Keep it that way.
- ⚠️ The runner runs from `master`, the Worker from the last deploy. Deploy soon after merging a
  change to `messages.mjs`, or a retry can send different content under the original key.
