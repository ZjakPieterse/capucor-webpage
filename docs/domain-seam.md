# The domain seam, and the operational rules that sit on it

> This repo is capucor.com: the site and the whole sales funnel, on one Cloudflare Worker. Since web-standalone (2026-10-07) it depends on no other repository. This page covers the one boundary it still has — **legacy redirects to the old client portal on capucor.app, kept until os-sunset** — **plus four operational contracts that were filed under it**: the web contract manifest, the scheduled workflows, the request-body caps, and the email delivery adapter.
>
> **Signing stops at `signed` + the signed PDF in Drive**: nothing in this repo writes a portal table, and failed sends are retried from this repo.
>
> Extracted from `AGENTS.md` on 2026-09-03 (EH-02); rewritten for web-standalone phase 5 on 2026-10-07.
>
> Canonical agent instructions: [`../AGENTS.md`](../AGENTS.md).

---

## Domain seam — capucor.com only

| Domain | Worker | Owns |
|--------|--------|------|
| **capucor.com** + www | `capucor-web` (this repo) | Marketing + the whole sales funnel: `/`, service pages, `/pricing`, `/privacy`, `/terms/*`, `/resources/*`, **and `/proposal/*`** (the signing document). Indexable — all canonicals, sitemap, OG |
| capucor.app + www | not this repo | The legacy client portal (login, portal, internal), being retired (os-sunset). Nothing here reads, writes or calls it |

There is no login, portal, onboarding or staff area in this repo, and none is to be added here.

### What is left of the seam: legacy redirects (until os-sunset)

The redirect table in `next.config.ts` is **one-directional**: someone asks capucor.com for an
old portal path, we bounce them to capucor.app. That is all.

- **`APP_PATHS`** — `/portal`, `/internal`, `/login`, `/onboarding` (+ sub-paths). These routes do
  not exist here at all; the redirect is the only thing between an old bookmark and a 404.
- **`www.capucor.com` → apex.** (Not legacy; stays.)
- **`/client-portal`** — a legacy public path, absolute to capucor.app.

**Nothing here can change how capucor.app behaves.** This Worker never answers on capucor.app, so
do not add a capucor.app→capucor.com rule or a capucor.app `noindex` header rule here — it could
not fire. Adding a new public page needs no redirect entry.

At os-sunset, `APP_PATHS`, `/client-portal` and the now-unused `siteConfig.appUrl` go together (the
Navbar's Client Portal link was removed 2026-10-08) (see `redirects.test.ts` and the contract's `redirects` entry).

### Rules that still hold

- **`siteConfig.url` does not exist.** Use `siteConfig.marketingUrl` (`src/config/site.ts`,
  overridable via `NEXT_PUBLIC_MARKETING_URL`). `siteConfig.appUrl` is unused since the Navbar's
  Client Portal link was removed (2026-10-08); the redirect table carries its own `APP_ORIGIN`.
  No email, signing page or API route links capucor.app — signed clients are told we will be in
  touch. Do not add a consumer.
- **Links to capucor.app must be absolute.** It is a different Worker; a relative route can never
  reach it.
- **Never add an `/api/*` host redirect.** A 301 on a POST downgrades it to GET and drops the body.
  This repo's API is single-host, so there is nothing to route — but the trap is still there
  for anyone who adds a rule later.
- **The funnel stays here in full**, including `/proposal/*`, `/api/proposals/sign*`, the signed
  PDF and the retry runner.

`wrangler dev` **does not run on the Windows dev box** (wrangler 4.84 dies with
`std::terminate()` on a bundle that deploys fine), so the old local host-faking recipe is
unavailable. Verify the table with `curl -sI` against the deployed Worker instead:

```bash
curl -sI https://capucor.com/portal      # 308 → https://capucor.app/portal
curl -sI https://capucor.com/login       # 308 → https://capucor.app/login
curl -sI https://www.capucor.com/pricing # 308 → https://capucor.com/pricing
curl -sI https://capucor.com/pricing     # 200 — never redirected
```

### Schema — what is left

**This repo owns the funnel schema** ([`database.md`](database.md)), and signing writes no portal
table: fulfilment is pdf → client email → owner email. The few objects that still cross into the
portal's tables until os-sunset are listed under "Links across the line" in
[`database.md`](database.md). A change to a portal table cannot break signing here.

### The web contract — `contracts/web-contract.json`

Since 2026-10-07 (web-standalone phase 2) this repo's invariants live in one **web-owned** manifest,
checked by `npm test` (`src/__tests__/web-contract.test.ts`). It
replaced an older cross-repo contract; nothing in it is compared with another repository.

- **Exact pins** — Next, `@opennextjs/cloudflare` and Wrangler move together; React,
  supabase-js and resend are pinned exact too; Node matches in `.nvmrc` and `ci.yml`.
- **Redirect table** — `APP_PATHS` keeps its entries; no redirect from `/api`, `/_next` or
  `/brand`.
- **Written rules** — `AGENTS.md` and `docs/database.md` say no agent applies a migration;
  `AGENTS.md` and `docs/deploy.md` say production deploys by manual dispatch.
- **Schema ownership** — the funnel baseline exists and its first statement raises.

`src/lib/pricing.ts`, `src/lib/proposalPricing.ts`, `src/config/tiers.ts`,
`src/lib/email/messages.mjs` and `src/types/db.ts` are this repo's own files; change them here
only. Copies elsewhere are not kept in step.

### Scheduled workflows

This repo runs three scheduled workflows — the POPIA lead prune (daily), the proposal expiry
(daily) and the fulfilment/email retry runner (`cron-reconcile-deliveries.yml`, hourly; see the
email section below). GitHub emails the owner when a run fails.

- ⚠️ **Nothing watches for a cron that stops silently.** The watchdog (`watchdog.yml`, with its
  cron, deploy-drift and CI-silence checks) was removed on 2026-10-08: its push-time checks were
  mostly false alarms, and production deploys already verify themselves in `deploy.yml`. A
  schedule GitHub disables (60 days without activity on a public repo) has to be noticed by eye
  on the Actions tab.

### Cloudflare

capucor.com + www are bound to the `capucor-web` Worker. The binding is managed in the dashboard,
not in `wrangler.jsonc` (which declares no `routes`), so a deploy from here cannot claim another
Worker's hostname.

⚠️ **Never delete the capucor.com zone or any of its DNS records.** Several are load-bearing for
services beyond this website, and removing them breaks those services silently while the sites keep
looking fine. Which records, and what each one carries, is kept out of this public repository on purpose (ADR 0010 part 3, 2026-08-20) and recorded in the owner's private workspace (Capucor wiki, `systems/capucor-com`).

### Request bodies are capped — never call `req.json()` in a route handler

**Read the body with `readJsonBody(req, MAX_BODY_BYTES)`** from
[`src/lib/readJsonBody.ts`](../src/lib/readJsonBody.ts), with a per-route `MAX_BODY_BYTES` constant
beside the route's `RATE_LIMIT_KEY`. All six body-reading routes here do.

⚠️ **`await req.json()` is unbounded — never introduce it in a route handler.**
`route-body-bounds.test.ts` pins the behaviour, including that the refusal happens before any
Supabase or email work. Routes that read **no** body need no cap; don't add one for symmetry.

⚠️ **`/api/proposals/sign` has three nested bounds and the order is deliberate.** Read the reasoning
before changing any of them — getting the order wrong degrades a real signer's error message.

The measurements behind these bounds, and why the nesting order matters, are kept out of this public repository on purpose (ADR 0010 part 3, 2026-08-20) and recorded in the owner's private workspace (Capucor wiki, `systems/capucor-com`).

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

**Retries run in this repo** (since web-standalone phase 3, 2026-10-07); nothing else retries
funnel emails.
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
  failures are listed as warnings, so one stuck row cannot keep the job red.
- ⚠️ **This repository is public, so the runner's logs are public.** It logs ids, event types,
  counts and error codes only — never a recipient, a link token, a message body or a provider
  error message. Keep it that way.
- ⚠️ The runner runs from `master`, the Worker from the last deploy. Deploy soon after merging a
  change to `messages.mjs`, or a retry can send different content under the original key.
