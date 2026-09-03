# The domain seam, and the operational rules that sit on it

> capucor.com (this repo) and capucor.app (`capucor-os`) are two domains, two repositories and two Cloudflare Workers. This page is everything this repo still has to know about that boundary — **plus four operational contracts that were filed under it**: the cross-repo manifest, the scheduled-workflow watchdog, the request-body caps, and the email delivery adapter.
>
> ⚠️ **The schema seam is the one that breaks silently** — a change in `capucor-os` can break this repo's provisioning path with no compile error and no failing test here.
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
  **Both URLs are still needed here.** `appUrl` has three live consumers: the Navbar's Client
  Portal CTA, the proposal page's "Sign in to your portal" link, and the portal invite in
  `lib/portal/finalizeSign.ts`.
- **Links that cross domains must be absolute.** Everything pointing at capucor.app is now a
  cross-repo link — it can never be a relative route.
- **Auth lives on capucor.app because a Supabase session cookie set on one eTLD+1 is unreachable
  from the other.** The two domains can never share a login. That constraint is why the split fell
  the way it did, and it does not change.
- **Never add an `/api/*` host redirect.** A 301 on a POST downgrades it to GET and drops the body.
  This repo's API is single-host now, so there is nothing to route — but the trap is still there
  for anyone who adds a rule later.
- **The funnel stays here in full**, including `/proposal/*`, `/api/proposals/sign*`, and
  **provision-on-sign**. A client signs on capucor.com; the write that gives them portal access on
  capucor.app happens in *this* repo — see the schema seam below.

`wrangler dev` **does not run on the Windows dev box** (wrangler 4.84 dies with
`std::terminate()` on a bundle that deploys fine), so the old local host-faking recipe is
unavailable. Verify the table with `curl -sI` against the deployed Worker instead:

```bash
curl -sI https://capucor.com/portal      # 308 → https://capucor.app/portal
curl -sI https://capucor.com/login       # 308 → https://capucor.app/login
curl -sI https://www.capucor.com/pricing # 308 → https://capucor.com/pricing
curl -sI https://capucor.com/pricing     # 200 — never redirected
```

### ⚠️ Schema seam — the one thing that can break silently

`supabase/migrations/` **lives in `../capucor-os` and nowhere else** (this repo's copy was deleted in
Phase 3). Marketing still starts provisioning at signing:
[`src/lib/portal/provision.ts`](../src/lib/portal/provision.ts) idempotently mints/locates the Auth
user, then calls the OS-owned `provision_from_signed_proposal` transaction.

⚠️ **A change on the capucor-os side can break this repo's provisioning path with no compile error
and no failing test here.** `src/__tests__/portal-provision.test.ts` pins the RPC argument boundary
but cannot see the database. The live check is `npm run e2e` **in capucor-os** — run it there after
any change to this path. Regenerate both repositories' database types whenever that RPC changes.

⚠️ **Read this before changing provisioning, and before changing any table it touches:**
[`../capucor-os/docs/engineering/prototype/CAPUCOR_WEB_SEAMS.md`](../../capucor-os/docs/engineering/prototype/CAPUCOR_WEB_SEAMS.md).

### The cross-repo contract — one command, in the other repo

⚠️ **`next.config.ts`'s `APP_PATHS`, the pinned runtime versions, the provisioning RPC boundary and
every file hand-synced with capucor-os are declared in
[`contracts/cross-repo-contract.json`](../contracts/cross-repo-contract.json)** — canonical in
`capucor-docs/contracts/`, vendored byte-identical here. Change one of those things and you must
change the manifest too, in all three copies.

- **CI enforces this repo's half** via `src/__tests__/cross-repo-contract.test.ts` (`npm test`).
  It cannot see capucor-os; the recorded **digest** of each hand-synced file is what covers that gap.
  Edit `src/lib/pricing.ts` here without editing capucor-os's copy and this repo goes red, naming
  the counterpart.
- **The full audit lives in capucor-os** — `npm run audit` there, read-only, all three repos, eight
  checks. It is the only thing that can compare the two repos to each other, so run it from a full
  workspace checkout before pushing a cross-repo change.
- Re-record digests after a sanctioned change with `npm run audit -- --print-digests` (in
  capucor-os) and paste into all three copies of the manifest.

### Scheduled workflows and the watchdog

This repo runs two scheduled workflows, and `.github/workflows/watchdog.yml` checks on every push
that each one is still succeeding, via `scripts/schedule-watchdog.mjs`.

- **The script is byte-identical to capucor-os's copy** and selects this repo's crons by matching
  `GITHUB_REPOSITORY` against `scheduledWorkflows.githubRepos`. Change one copy and the audit's
  `duplicate-file` check goes red.
- ⚠️ **A new cron must be declared in `scheduledWorkflows`** in all three copies of the manifest, or
  the audit's `schedule` check fails — an undeclared cron is a job nothing watches.
- **Zero dependencies and `actions: read` only.** Keep it that way; the audit's `schedule` check
  fails if `npm ci` appears in that workflow.
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

Every transactional send goes through [`src/lib/email/sendEmail.ts`](../src/lib/email/sendEmail.ts).
Do not construct `Resend` or call `resend.emails.send()` anywhere else. The adapter requires a
stable business-event idempotency key, bounds the provider call, checks both returned errors and
thrown failures, and returns `accepted` only with a provider message id. `accepted` means the
provider accepted the API request, not that the recipient opened or even received it. Never log a
link token or idempotency key, and never write a sent timestamp from a `pending` result.

The adapter persists one `email_deliveries` row **before** calling Resend, claims it with a
60-second lease, and passes the same globally unique key to the provider. Returned errors, thrown
transport failures, timeouts and missing provider configuration become `retry_scheduled`; repeated
or concurrent requests load the existing event instead of creating another provider message. A
stale processing lease is reclaimable with the same provider key. Callers must supply a UUID source
(`lead`, `data_request` or `proposal`) and a dotted event type; store no subject, body, snippet,
recipient link token or other message content in the operational table. The weekday business-hours
GitHub Action in capucor-os now drains due work every ten minutes with six bounded attempts and
fails visibly on permanent work. It rebuilds messages through the dependency-free
`src/lib/email/messages.mjs`; keep that file byte-equivalent to capucor-os's copy so the retry sends
the exact original provider payload.
