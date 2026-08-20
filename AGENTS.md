<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

> **Canonical agent instructions for Capucor Web.** Every agent — Claude, Gemini, Codex,
> Antigravity, Cursor, and any future tool — should read this file. `CLAUDE.md` and `GEMINI.md`
> are thin pointers to it; **edit this file, not them.**

# Capucor Web — Project Reference

Capucor Business Solutions public website and sales funnel — capucor.com. South African outsourced
accounting firm targeting modern SMEs. Deployed to Cloudflare Workers via OpenNext.

**This repo is marketing only.** The client portal, `/internal` and login are **Capucor OS**, a
separate repo and Worker on capucor.app — see [`../capucor-os/AGENTS.md`](../capucor-os/AGENTS.md)
and the "Domain seam" section below.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React Server Components) |
| UI | React 19, Tailwind CSS v4, shadcn/ui (Base Nova) |
| Database & Auth | Supabase (PostgreSQL) |
| Forms | React Hook Form + Zod |
| Email | Resend |
| Payments | Subscriptions: Paysoft Flow debit orders (Xero-integrated, manual — no API). Shop one-offs: PayFast (not yet wired) — see "Payments status" below. |
| Deployment | Cloudflare Workers via opennextjs-cloudflare |
| Testing | Vitest |

## Prerequisites

- Node.js 24 (see `.nvmrc`; CI pins the same). Was Node 20 until 2026-08-03 — that reached end of
  life on 30 April 2026, and the mismatch against the dev box's Node 24 / npm 11 was what made
  regenerating `package-lock.json` locally unsafe. Both ends now match. Keep `.nvmrc` and
  `.github/workflows/ci.yml` in step.
- A Supabase project
- A Cloudflare account with Workers enabled (for deploy)

## Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template and fill in values
cp .env.example .env.local
```

**Required environment variables** (see `.env.example` for all):

| Variable | Where to find it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API (never expose client-side) |
| `REVALIDATE_SECRET` | Any long random string — `openssl rand -hex 32` |
| `RESEND_API_KEY` | Resend dashboard. Optional locally (delivery reports `pending` and link-bearing routes log their URL); required in production. |
| `OWNER_NOTIFICATION_EMAIL` | e.g. `zjak@capucor.com` |
| `NEXT_PUBLIC_BOOKING_URL` | Your booking/calendar link (falls back to Google Calendar URL if absent) |
| `NEXT_PUBLIC_MARKETING_URL` / `NEXT_PUBLIC_APP_URL` | Optional. Defaults are the production values (`https://capucor.com` / `https://capucor.app`) — override only for a staging host. See "Domain seam" below |
| `APPS_SCRIPT_PDF_URL` / `APPS_SCRIPT_PDF_SECRET` | Signed-proposal PDF archival (PR10/PH-06). Apps Script web-app `/exec` URL + its shared secret; when unset the legal signature remains committed but fulfilment stays visibly pending. See `scripts/apps-script/README.md` |

## Dev Scripts

```bash
npm run dev          # Start dev server with Turbopack (http://localhost:3000)
npm run lint         # ESLint over src/
npm run test         # Run Vitest unit tests
npm run test:watch   # Vitest in watch mode
npm run test:ui      # Open Vitest browser UI
npm run db:types     # Regenerate Supabase TypeScript types → src/types/db.ts
```

## Build & Deploy (Cloudflare)

```bash
npm run build:cf     # Build for Cloudflare Workers
npm run preview:cf   # Build and run local Cloudflare preview
npm run deploy:cf    # Build and deploy to Cloudflare Workers (see deploy rules below)
```

The Cloudflare target is configured in `wrangler.jsonc` and `open-next.config.ts`.

### ⚠️ Deployment & operational rules (read before deploying)

These are hard-won and load-bearing — ignoring them has taken production down:

- **Deploy to prod by MANUAL DISPATCH ONLY.** `.github/workflows/deploy.yml` runs the
  secrets-driven `build:cf` + `wrangler deploy` on Ubuntu. It triggers on `workflow_dispatch`
  alone and refuses to run unless you type `deploy` into its `confirm` input.
- **Merging to `master` no longer ships anything.** `ci.yml` validates and stops; it has no deploy
  step and must never get one. A merged fix is NOT a shipped fix here any more, so someone has to
  remember to dispatch the deploy. This is deliberate (ADR 0010 part 1, extending ADR 0003 to this
  repo) and it removed an unattended path from merge to a live surface handling signed engagements
  and debit-order mandates.
- **NEVER run `npm run deploy:cf` from the Windows dev box.** OpenNext's Windows build produces
  a runtime-broken worker (`ChunkLoadError` on every server route). If a bad deploy ships,
  recover with **`wrangler rollback`**.
- **The build is pinned to webpack** (`next build --webpack`), not Turbopack — OpenNext-for-
  Cloudflare cannot bundle a Turbopack build into a working worker.
- **The coupled runtime is pinned exact:** Next.js / `eslint-config-next` **16.3.0**,
  `@opennextjs/cloudflare` **1.20.2** and Wrangler **4.86.0**. Move them together and verify a full
  `build:cf`; a caret on OpenNext previously allowed a clean install to select an adapter whose
  Next peer range the app did not satisfy.
- **No edge-runtime routes.** Cloudflare Workers are already edge; do not add
  `export const runtime = 'edge'` (it breaks the OpenNext bundle — e.g. `/api/og` had it removed).
- **ISR caching:** `/` and `/pricing` are cached for 1 hour (`export const revalidate = 3600`)
  via the OpenNext KV incremental cache (`open-next.config.ts` + the `NEXT_INC_CACHE_KV` binding
  in `wrangler.jsonc`). After editing pricing in Supabase, refresh them immediately with
  `POST /api/revalidate?secret=<REVALIDATE_SECRET>` (GET also works for browser use). Do not add
  `revalidate` to `/proposal/[token]` — it mutates status on view.
- Prod smoke-check: `curl -sD- -o /dev/null https://capucor.com/pricing | grep -i content-security-policy`
  should show the Supabase host in `connect-src`. `deploy.yml` runs this same check post-deploy.
  **Don't point it at capucor.app** — that is a different Worker from a different repo, so it would
  report capucor-os's health, not this deploy's.

## Domain seam — capucor.com vs capucor.app

**Two domains, two repos, two Cloudflare Workers.** This repo is capucor.com only.

| Domain | Repo | Worker | Owns |
|--------|------|--------|------|
| **capucor.com** + www | **this one** (`capucor-webpage`) | `capucor-web` | Marketing + the whole sales funnel: `/`, service pages, `/pricing`, `/privacy`, `/terms/*`, `/resources/*`, **and `/proposal/*`** (the signing document). Indexable — all canonicals, sitemap, OG |
| **capucor.app** + www | [`../capucor-os`](../capucor-os/AGENTS.md) | `capucor-os` | **Capucor OS**: `/login`, `/onboarding`, `/portal/*`, `/internal/*`. `noindex` on every response |

> **Working on the portal, `/internal`, login, or anything a signed-in user sees?
> Wrong repo — go to [`../capucor-os/AGENTS.md`](../capucor-os/AGENTS.md).** None of that code is
> here any more; it was deleted in Phase 3 of the OS split (2026-08-02, `ac91b75`) and git history
> keeps it. What went, what stayed and why is in
> [`../capucor-docs/archive/capucor-web-phase-history.md`](../capucor-docs/archive/capucor-web-phase-history.md).

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
[`src/lib/portal/provision.ts`](src/lib/portal/provision.ts) idempotently mints/locates the Auth
user, then calls the OS-owned `provision_from_signed_proposal` transaction.

⚠️ **A change on the capucor-os side can break this repo's provisioning path with no compile error
and no failing test here.** `src/__tests__/portal-provision.test.ts` pins the RPC argument boundary
but cannot see the database. The live check is `npm run e2e` **in capucor-os** — run it there after
any change to this path. Regenerate both repositories' database types whenever that RPC changes.

⚠️ **Read this before changing provisioning, and before changing any table it touches:**
[`../capucor-os/docs/engineering/prototype/CAPUCOR_WEB_SEAMS.md`](../capucor-os/docs/engineering/prototype/CAPUCOR_WEB_SEAMS.md).

### The cross-repo contract — one command, in the other repo

⚠️ **`next.config.ts`'s `APP_PATHS`, the pinned runtime versions, the provisioning RPC boundary and
every file hand-synced with capucor-os are declared in
[`contracts/cross-repo-contract.json`](contracts/cross-repo-contract.json)** — canonical in
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
[`../capucor-os/docs/engineering/prototype/CAPUCOR_WEB_SEAMS.md`](../capucor-os/docs/engineering/prototype/CAPUCOR_WEB_SEAMS.md).

### Cloudflare

capucor.com + www are bound to the `capucor-web` Worker; capucor.app + www to `capucor-os`. The
bindings are managed in the dashboard, not in `wrangler.jsonc` (which declares no `routes`), so a
deploy from either repo cannot claim the other's hostname.

⚠️ **Never delete the capucor.com zone or any of its DNS records.** Several are load-bearing for
services beyond this website, and removing them breaks those services silently while the sites keep
looking fine. Which records, and what each one carries:
[`../capucor-os/docs/engineering/prototype/CAPUCOR_WEB_SEAMS.md`](../capucor-os/docs/engineering/prototype/CAPUCOR_WEB_SEAMS.md).

### Request bodies are capped — never call `req.json()` in a route handler

**Read the body with `readJsonBody(req, MAX_BODY_BYTES)`** from
[`src/lib/readJsonBody.ts`](src/lib/readJsonBody.ts), with a per-route `MAX_BODY_BYTES` constant
beside the route's `RATE_LIMIT_KEY`. All six body-reading routes here do.

⚠️ **`await req.json()` is unbounded — never introduce it in a route handler.**
`route-body-bounds.test.ts` pins the behaviour, including that the refusal happens before any
Supabase or email work. Routes that read **no** body need no cap; don't add one for symmetry.

⚠️ **`/api/proposals/sign` has three nested bounds and the order is deliberate.** Read the reasoning
before changing any of them — getting the order wrong degrades a real signer's error message.

The measurements behind these bounds, and why the nesting order matters:
[`../capucor-os/docs/engineering/prototype/CAPUCOR_WEB_SEAMS.md`](../capucor-os/docs/engineering/prototype/CAPUCOR_WEB_SEAMS.md).

### Email delivery contract

Every transactional send goes through [`src/lib/email/sendEmail.ts`](src/lib/email/sendEmail.ts).
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

## Database (Supabase)

Both apps share **one Supabase project**, but ⚠️ **this repo does not own the schema.**

**`supabase/migrations/` lives in [`../capucor-os`](../capucor-os/AGENTS.md) and nowhere else** —
this repo's copy was deleted in Phase 3 of the OS split. Write new migrations there, and apply them
using the canonical OS migration workflow.

✅ **`supabase db push` is allowed since 2026-08-06**, from `capucor-os` and nowhere else. It was
forbidden until then because the live database had **no migration ledger at all** — the
`supabase_migrations` schema did not exist (measured read-only, 2026-08-05 and again on 2026-08-06),
so `db push` would have tried to run all 23 migrations against a database that already had every
table. The ledger was created and backfilled on 2026-08-06 and the dry run now proposes nothing.
Whichever way a migration is applied, the OS `db:check` is still what proves it. Dated record:
[`../capucor-docs/operations/migration-ledger-repair-plan.md`](../capucor-docs/operations/migration-ledger-repair-plan.md).

⛔ **`009a` / `009b` are deliberately absent from the ledger** and must stay that way — a ledger
version with no matching local file blocks *every* push. Measured 2026-08-06.

That matters here because marketing still initiates OS-owned provisioning at signing
(`lib/portal/provision.ts` → `provision_from_signed_proposal`). See the **Schema seam** warning
under "Domain seam" before changing the RPC or its four internal tables.

Regenerate TypeScript types after a schema change:

```bash
# Replace YOUR_PROJECT_REF with your Supabase project reference ID
npm run db:types
```

Generated types land in `src/types/db.ts` and are tracked. Regenerate and commit them after schema
changes; CI rejects drift from the live schema.

### Supabase clients — pick the right one (load-bearing)

There are three server-side clients in `src/lib/supabase/`; choosing wrong causes silent data
loss, not an error:

- **`createSupabaseAnonClient()` (`anon.ts`) — for PUBLIC reads.** Cookieless; always runs as the
  `anon` role. Use for the public pricing config (`services`, `brackets`, `tiers`) and
  `testimonials` — on the pricing calculator, homepage packages teaser, proposal view, and
  server-side price math.
- **`createSupabaseServerClient()` (`server.ts`) — for per-user reads.** Cookie-bound; adopts the
  visitor's session role. Used here for lead / data-request inserts.
- **`createSupabaseAdminClient()` (`admin.ts`) — for privileged writes.** Service-role; bypasses
  RLS. Server-only mutations — provision-on-sign, the signing flow, the crons. Never import into
  browser code.

**There is no browser client in this repo.** `supabase/client.ts` went to capucor-os with `/login`
in Phase 3; every Supabase call here is server-side. Don't add one back for a marketing feature —
if a public page needs data, fetch it in a server component.

⚠️ **The public pricing tables only grant `select to anon`** (migration `001_schema.sql`, now in
capucor-os; no `to authenticated` policy). Reading them via the cookie-bound server client means a
**signed-in** visitor runs as `authenticated`, matches no policy, and silently gets **zero rows**
(no error) — which renders the calculator unavailable for logged-in users only. Always read public
data with `createSupabaseAnonClient`. Since Phase 3 there is no way to be signed in *on
capucor.com* — the session cookie belongs to capucor.app — so this trap is now much harder to
trip here. Keep the rule anyway: it costs nothing, and the same policies bite for real in
capucor-os, where signed-in staff read exactly these tables.

## Project Structure

```
src/
├── app/              # Next.js App Router pages and API routes
├── components/
│   ├── landing/      # Homepage sections (Hero, ProblemCards, etc.)
│   ├── pricing/      # Multi-step pricing calculator
│   ├── proposal/     # Signing document (sign form, confirm button)
│   ├── ui/           # shadcn + custom UI primitives
│   ├── layout/       # Navbar, Footer
│   └── services/     # Service page components
├── config/           # siteConfig, tier config, proposal terms, compliance calendar
├── hooks/            # usePricingState, useCursorGlow
├── lib/              # utils, pricing logic, Supabase clients, validations
│   ├── log.ts        # structured one-line-JSON logging into Workers Logs.
│   │                 #   Use logError/logWarn/logInfo, not console.*; `evt` is a
│   │                 #   stable dotted id you can query on in the Cloudflare
│   │                 #   dashboard. Byte-identical to capucor-os's copy.
│   ├── portal/       # ⚠️ NAME IS HISTORICAL — this is the SIGNING half, not a portal:
│   │                 #   finalizeSign, provision, proposalPdf, signEmails, orgSlug.
│   │                 #   The actual portal is in ../capucor-os.
│   └── proposal/     # Proposal document rendering (HTML → PDF, inlined logo)
└── types/            # TypeScript interfaces
```

### App Router layouts (route-group topology, PR11)

The root `app/layout.tsx` is a **bare shell** — `<html>` + fonts + `globals.css` + the default
metadata only, no chrome. Chrome is applied per area by nested layouts:

- **`app/(site)/layout.tsx`** — marketing chrome (Navbar + Footer). **All public pages live in the
  `(site)` route group** (home, services, pricing, privacy, terms, resources).
  Route groups don't change the URL, so **a new public/marketing page goes in `app/(site)/`, not
  `app/`.**
- **`app/proposal/layout.tsx`** — bare, no chrome (the standalone signing document).

Root `not-found.tsx` / `error.tsx` stay at `app/` root and render bare (the global 404 has no
marketing chrome by design).

The `app/(app)/`, `app/portal/` and `app/internal/` layouts were deleted in Phase 3 — they belong
to [`../capucor-os`](../capucor-os/AGENTS.md) now. Two route groups remain here, `(site)` and the
bare `proposal/`.

## Project Tracker

`../capucor-docs/operations/audit-portal-tasks.md` (in the private `capucor-docs` repo, a sibling
of this one) is the living
tracker for the audit + client-portal plan. When you start or finish any tracked item, update
its checkbox and the "Last reviewed" date, and keep the `## Changelog` at the foot of that file
current. It lives outside this git repo by design (it is not pushed to GitHub).

## Maintenance & self-review

Keep this file and the project's reference surface accurate, agent-neutral, and lean. Re-run a
review after any significant change, or roughly every 5 days. **Any agent can do it** — with
Claude, run the `/self-review` skill; other agents follow this checklist directly:

- **Drift** — paths, npm scripts (vs `package.json`), commands, and env-var names in the docs
  still match the code; referenced files exist.
- **Agent-neutrality** — this `AGENTS.md` stays the canonical, self-contained source; `CLAUDE.md`
  / `GEMINI.md` remain thin pointers; no references to renamed/deleted files; operational rules
  (e.g. the deploy section above) live here, not only in an agent's private memory.
- **Duplication & refs** — one canonical home per topic (others point to it); cross-links and
  file paths resolve.
- **Freshness & leanness** — stale claims removed, relative dates made absolute, history moved to
  changelogs / `archive/`, index files kept terse.
- **Skills & memory hygiene** — skill descriptions accurate; (Claude) `MEMORY.md` matches its
  files and durable learnings are captured.

Auto-fix mechanical issues (broken refs, stale stamps, dedup); propose judgment calls. The
freshness stamp lives in the workspace-root `AGENTS.md` (`Last reviewed: <date>`) — update it
when you finish a pass. This section doubles as the **paste-in template** for a new project's
`AGENTS.md`.

## Design System & UI Conventions

These are the load-bearing rules for the site's look and feel. Follow them for all new
UI work so the front end stays visually consistent. Canonical examples are cited inline.

### Section rhythm

- Standard content sections use `className="premium-section py-14 lg:py-20"`. Hero and the
  final CTA run heavier (`py-20`/`24`/`28`/`36`); match a neighbouring section rather than
  inventing new spacing. Examples: `ProblemCards`, `ServicePillars`,
  `PackagesTeaser`, `ContactSection`.
- `.premium-section` (in `globals.css`) is a primitive: it sets `position: relative` and
  paints a faint dual radial-gradient backdrop via `::before`. Use `.premium-section-muted`
  for the alternate muted-gradient surface.
- **Every `premium-section` opens with `<SectionDivider />`** as its first child — a faint
  1px `.premium-divider` gradient hairline pinned to the section's top edge
  (`components/ui/SectionDivider.tsx`). It gives the section boundary its rhythm; do not
  reach for thicker borders, hard rules, or background-color alternation instead. The
  topmost section on a page (the Hero) omits it — nothing above it to separate from. Do not
  double up with extra inline `.premium-divider` markers inside a section that already has
  a divider above or below.

### Client portal surfaces — moved out

The portal's design rules (card-based surface, `PORTAL_CARD` / `PORTAL_PANEL`, the shared header
components) left with the code in Phase 3. They now live in
[`../capucor-os/AGENTS.md`](../capucor-os/AGENTS.md).

**Everything below this line is marketing design guidance and still applies here.** The one portal
rule worth remembering on this side: the app surface deliberately does *not* use the
`premium-section` / `SectionDivider` rhythm — so don't reach for capucor-os as a precedent when
building a marketing section, or vice versa.

The exception is `/proposal/*`, which is neither: it's a standalone document with its own bare
layout, no Navbar/Footer and no section rhythm. It lives here and stays here.

### Hover / interaction states — read before adding any `:hover`

- **Hover styling lives as named CSS classes in `globals.css`, not Tailwind `hover:`
  utilities.** Tailwind v4 + Turbopack does not reliably emit `hover:` utilities here, so
  hover effects written inline silently fail to render. Add a class (e.g. `.feature-card`,
  `.problem-card`, `.service-card`, `.premium-card`) and define its `:hover` in `globals.css`.
- **Gate hover rules with `@media all`, never `@media (hover: hover)`.** Chromium reports
  `hover: none / pointer: coarse` on Windows hybrid touchscreen-laptops even with a mouse
  attached, which kills `(hover: hover)`-gated effects on those machines. See the comment
  at the top of the hover block in `globals.css`. Do not "fix" this to the conventional gate.
- Pair every hover treatment with a press state in the
  `@media (hover: none) and (pointer: coarse)` block so pure-touch devices get `:active`
  tap feedback (short scale-down). Mirror the existing card list there.
- Standard motion easing across hovers, price animation, and reveals is
  `cubic-bezier(0.16, 1, 0.3, 1)`. Reuse it; respect `useReducedMotion` (see `AnimatedPrice`).

### Multi-card alignment (pricing, comparison rows)

- Rows of peer cards align their internal rows via CSS subgrid, not hand-tuned heights. The
  grid declares `grid-template-rows: auto auto … 1fr` and each card uses
  `grid-template-rows: subgrid` (see `.pricing-grid-container` / `.pricing-card-item` in
  `globals.css`, consumed by `Step2Tiers.tsx`).
- **Always reserve a row even when a card has no content for it** — render an invisible
  placeholder (`h-0 w-0 opacity-0 aria-hidden`) so the subgrid row still exists and the
  cards line up. See the `else` branch of the cumulative-label row in `Step2Tiers.tsx`.

### Tailwind layering gotcha

- **Don't mix responsive shorthand with base side-overrides.** `p-4 sm:p-5 pr-12` silently
  loses the right padding at `sm+` — the `sm:p-5` media-query rule lands later in the cascade
  and resets all four sides. Pair them per breakpoint instead: `p-4 pr-14 sm:p-5 sm:pr-16`.
  (This is how the add-on card's corner toggle ended up overlapping its price.)

### Repeated component treatments

- When a visual element appears on some cards in a set, give it to **all** peers for rhythm;
  vary only the icon and copy, keep the styling byte-identical. Example: the tier "intro
  pills" — all three pricing tiers carry the same pill (`bg-primary/5 border border-primary/10
  rounded-md px-2.5 py-1`), differing only in icon (`Layers` for Basic, `CornerDownRight`
  for Pro/Premium) and label (`TIER_CUMULATIVE_LABELS` in `config/tiers.ts`).

### Price display

- Show the amount and the period (`/month`) on one baseline-aligned row: the period is a
  small `whitespace-nowrap` subtext to the right of the price, never stacked below it and
  never allowed to wrap. Use `AnimatedPrice` for ZAR amounts (handles the animated count-up,
  the `R` glyph, tabular nums, and reduced-motion). See the price block in `Step2Tiers.tsx`.

### Voice & copy (applies to all UI text)

Plain, direct, human. The rules below are the essentials; the **full guide** (complete
banned-vocab list, ✅/❌ examples, South African specificity, sample copy) lives in
[`docs/voice-and-copy.md`](./docs/voice-and-copy.md) — read it before writing or reviewing
user-visible copy.

- **Banned vocab:** "best-in-class", "tech-forward", "cutting-edge", "seamless", "leverage",
  "robust", "purpose-built", and similar marketing filler. **Banned structures:** em-dash
  overuse, "not just X, but Y" negative parallelism, triple-repetition ("always …, always …,
  always …" / "no …, no …, no …"). Write what the thing does, not how impressive it is.
  Headings are sentence case.
- **South African specificity is a strength:** SARS, CIPC, EMP201, VAT201, POPIA, SAICA, etc.
  — use the real terms, never soften them into generic equivalents.
- **Apostrophes in JSX text must be `&apos;`.** Raw `'` in literal JSX text content (e.g.
  `<p>You'll see…</p>`) trips the `react/no-unescaped-entities` ESLint rule and breaks CI —
  write `You&apos;ll`. Applies only to literal JSX text; apostrophes inside JS string
  literals (e.g. an array rendered via `{item.body}`) are fine as-is.

## Payments status (billing model changed — read before touching payment code)

The original plan wired **Paystack** for both subscriptions and shop checkout. The **2026-06-17
billing decision** (documented in `../capucor-docs/operations/audit-portal-tasks.md`) changed that:

- **Subscriptions** are collected via **Paysoft Flow** (Xero-integrated bulk debit orders). It has
  **no developer API**, so provisioning is **manual** in Xero/Paysoft Flow — the signed proposal is
  the debit-order mandate and **no banking details are captured on the site**. Portal access is
  minted at signing by provision-on-sign (PR9, live), not by a payment webhook.
- **Shop one-offs** will use **PayFast** (signed redirect + an ITN webhook validated by MD5
  signature + a server postback) — not yet wired in code.

⛔ **There is no Paystack code here.** It was deleted on 2026-08-01 and **none of it is worth
resurrecting** — the shop needs PayFast's ITN/MD5 scheme, not Paystack's HMAC-SHA512, and
subscriptions are provisioned on sign rather than by a payment webhook. Inventory of what went, in
[`../capucor-docs/archive/capucor-web-phase-history.md`](../capucor-docs/archive/capucor-web-phase-history.md).
`lib/security.ts` (`timingSafeEqual`) stayed; it is used by `/api/revalidate` and both cron routes.

**When the PayFast shop path lands it starts from scratch:** a signed redirect plus an ITN webhook
validated by MD5 signature and a server postback.

(The client portal and `/onboarding` are **live**, not stubs — they run in
[`../capucor-os`](../capucor-os/AGENTS.md) on capucor.app. **Provision-on-sign stays in this
repo**: `lib/portal/provision.ts` runs when a client signs on capucor.com.)

## Pending Content: Client Testimonials / Social Proof

The slot reserved for **real client testimonials / social proof** sits between the **What we do** (`ServicePillars`) and **Packages** (`PackagesTeaser`) sections. Its previous occupant — the "A Month with Capucor" four-week timeline (`OutcomeStories.tsx`) — was removed.

- Placement: `src/app/(site)/page.tsx`, between `ServicePillars` and `PackagesTeaser` (look for the placeholder HTML comment). The homepage FAQ was retired and its `FaqAccordion` + `config/faq.ts` removed; rebuild fresh if a FAQ section is wanted later.
- Blocker: testimonials still need to be collected from clients. Once 3–5 quotes (name, role, company, quote, ideally a headshot) are in hand, build a new `Testimonials.tsx` landing component and slot it in.
- Do not ship the old four-week timeline visual back — it was scrapped intentionally. Build fresh around the real quotes.
