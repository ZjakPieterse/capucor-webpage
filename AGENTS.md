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

- Node.js 20 (see `.nvmrc`)
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
| `RESEND_API_KEY` | Resend dashboard (optional — logs to console if absent) |
| `OWNER_NOTIFICATION_EMAIL` | e.g. `zjak@capucor.com` |
| `NEXT_PUBLIC_BOOKING_URL` | Your booking/calendar link (falls back to Google Calendar URL if absent) |
| `NEXT_PUBLIC_MARKETING_URL` / `NEXT_PUBLIC_APP_URL` | Optional. Defaults are the production values (`https://capucor.com` / `https://capucor.app`) — override only for a staging host. See "Domain seam" below |
| `APPS_SCRIPT_PDF_URL` / `APPS_SCRIPT_PDF_SECRET` | Signed-proposal PDF archival (PR10). Apps Script web-app `/exec` URL + its shared secret; archival no-ops if unset. See `scripts/apps-script/README.md` |

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

- **Deploy to prod via CI push to `master` ONLY.** `.github/workflows/ci.yml` runs the
  secrets-driven `build:cf` + `wrangler deploy` on Ubuntu.
- **NEVER run `npm run deploy:cf` from the Windows dev box.** OpenNext's Windows build produces
  a runtime-broken worker (`ChunkLoadError` on every server route). If a bad deploy ships,
  recover with **`wrangler rollback`**.
- **The build is pinned to webpack** (`next build --webpack`), not Turbopack — OpenNext-for-
  Cloudflare cannot bundle a Turbopack build into a working worker.
- **No edge-runtime routes.** Cloudflare Workers are already edge; do not add
  `export const runtime = 'edge'` (it breaks the OpenNext bundle — e.g. `/api/og` had it removed).
- **ISR caching:** `/` and `/pricing` are cached for 1 hour (`export const revalidate = 3600`)
  via the OpenNext KV incremental cache (`open-next.config.ts` + the `NEXT_INC_CACHE_KV` binding
  in `wrangler.jsonc`). After editing pricing in Supabase, refresh them immediately with
  `POST /api/revalidate?secret=<REVALIDATE_SECRET>` (GET also works for browser use). Do not add
  `revalidate` to `/proposal/[token]` — it mutates status on view.
- Prod smoke-check: `curl -sD- -o /dev/null https://capucor.com/pricing | grep -i content-security-policy`
  should show the Supabase host in `connect-src`. CI runs this same check post-deploy. **Don't
  point it at capucor.app** — that is a different Worker from a different repo, so it would report
  capucor-os's health, not this deploy's.

## Domain seam — capucor.com vs capucor.app

**Two domains, two repos, two Cloudflare Workers.** This repo is capucor.com only.

| Domain | Repo | Worker | Owns |
|--------|------|--------|------|
| **capucor.com** + www | **this one** (`capucor-webpage`) | `capucor-web` | Marketing + the whole sales funnel: `/`, service pages, `/pricing`, `/privacy`, `/terms/*`, `/resources/*`, **and `/proposal/*`** (the signing document). Indexable — all canonicals, sitemap, OG |
| **capucor.app** + www | [`../capucor-os`](../capucor-os/AGENTS.md) | `capucor-os` | **Capucor OS**: `/login`, `/onboarding`, `/portal/*`, `/internal/*`. `noindex` on every response |

> **Working on the portal, `/internal`, login, or anything a signed-in user sees?
> Wrong repo — go to [`../capucor-os/AGENTS.md`](../capucor-os/AGENTS.md).** None of that code is
> here any more. It was deleted in **Phase 3 of the OS split (2026-08-02)**, after capucor.app had
> been served by its own Worker since Phase 1c. Git history keeps it if you need to look something
> up.

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

`supabase/migrations/` **lives in `../capucor-os` and nowhere else** (this repo's copy was deleted
in Phase 3). But marketing still *writes* to those tables:
[`src/lib/portal/provision.ts`](src/lib/portal/provision.ts) runs at signing and writes
`client_orgs`, `client_org_members`, `subscriptions` and `proposals`, and mints the auth user.

A rename or reshape of any of those in a capucor-os migration produces **no compile error and no
failing test in either repo** — the symptom is a paying client who signs and never gets portal
access. `src/__tests__/portal-provision.test.ts` pins the exact column set written to each table so
a rename lands as a red test. **If that test goes red, find the migration that moved before you
touch the list.** Read the header comment on `provision.ts` first.

### Cloudflare

capucor.com + www are bound to the `capucor-web` Worker; capucor.app + www to `capucor-os`. The
bindings are managed in the dashboard, not in `wrangler.jsonc` (which declares no `routes`), so a
deploy from either repo cannot claim the other's hostname.

⚠️ **Never delete the capucor.com zone or its MX / SPF / `resend._domainkey` DKIM / DMARC
records** — capucor.com is the verified Resend *sender* domain. Removing them silently kills every
transactional email from **both** apps while the sites keep looking fine. This is still true even
though capucor.com no longer serves any signed-in surface.

## Database (Supabase)

Both apps share **one Supabase project**, but ⚠️ **this repo does not own the schema.**

**`supabase/migrations/` lives in [`../capucor-os`](../capucor-os/AGENTS.md) and nowhere else** —
this repo's copy was deleted in Phase 3 of the OS split. Write new migrations there, and apply them
via the Supabase dashboard SQL editor or `supabase db push` from that repo.

That matters here because marketing still **writes** to OS-owned tables at signing
(`lib/portal/provision.ts` → `client_orgs`, `client_org_members`, `subscriptions`, `proposals`).
See the **Schema seam** warning under "Domain seam" before changing any of them — a rename over
there breaks provisioning here with no compile error.

Regenerate TypeScript types after a schema change:

```bash
# Replace YOUR_PROJECT_REF with your Supabase project reference ID
npm run db:types
```

Generated types land in `src/types/db.ts` (gitignored — regenerate after pulling schema changes).

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

`../AUDIT-PORTAL-TASKS.md` (at the workspace root, one level above this repo) is the living
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
billing decision** (documented in `../AUDIT-PORTAL-TASKS.md`) changed that:

- **Subscriptions** are collected via **Paysoft Flow** (Xero-integrated bulk debit orders). It has
  **no developer API**, so provisioning is **manual** in Xero/Paysoft Flow — the signed proposal is
  the debit-order mandate and **no banking details are captured on the site**. Portal access is
  minted at signing by provision-on-sign (PR9, live), not by a payment webhook.
- **Shop one-offs** will use **PayFast** (signed redirect + an ITN webhook validated by MD5
  signature + a server postback) — not yet wired in code.

**The Paystack stubs were deleted on 2026-08-01** (Phase 0 of the Capucor OS split). Removed:
`api/subscriptions/route.ts`, `api/webhooks/paystack/route.ts`, `lib/paystack.ts`, their schemas
and tests, and the `PAYSTACK_SECRET_KEY` env var. None of it carried over — the shop needs the
**PayFast ITN/MD5** scheme, not Paystack's HMAC-SHA512, and subscriptions are provisioned on sign
rather than by a payment webhook. `lib/security.ts` (`timingSafeEqual`) stayed; it is used by
`/api/revalidate` and both cron routes.

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
