<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

> **Canonical agent instructions for Capucor Web.** Every agent — Claude, Gemini, Codex,
> Antigravity, Cursor, and any future tool — should read this file. `CLAUDE.md` and `GEMINI.md`
> are thin pointers to it; **edit this file, not them.**

# Capucor Web — Project Reference

Capucor Business Solutions public website and client portal. South African outsourced accounting firm targeting modern SMEs. Deployed to Cloudflare Workers via OpenNext.

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
  `revalidate` to `/proposal/[token]` (it mutates status on view) or any portal page (per-user).
- Prod smoke-check: `curl -sD- -o /dev/null https://capucor.app/login | grep -i content-security-policy`
  should show the Supabase host in `connect-src`. (`/login` is on capucor.app — see the domain
  seam below.)

## Domain seam — capucor.com vs capucor.app

Two domains, two jobs. **One Worker serves both**; the separation is enforced by the host-based
redirect table in `next.config.ts`, not by infrastructure.

| Domain | Owns | Indexable |
|--------|------|-----------|
| **capucor.com** | Marketing + the whole sales funnel: `/`, service pages, `/pricing`, `/privacy`, `/terms/*`, `/resources/*`, **and `/proposal/*`** (the signing document) | Yes — all canonicals, sitemap, OG |
| **capucor.app** | **Capucor OS**: `/login`, `/onboarding`, `/portal/*`, `/internal/*` | No — `X-Robots-Tag: noindex` on every response |

Rules that keep this working:

- **`siteConfig.url` no longer exists.** Use `siteConfig.marketingUrl` or `siteConfig.appUrl`
  (`src/config/site.ts`, overridable via `NEXT_PUBLIC_MARKETING_URL` / `NEXT_PUBLIC_APP_URL`).
  Almost everything is `marketingUrl`; `appUrl` is for auth/portal links only. The one live
  example is the portal invite in `lib/portal/finalizeSign.ts`.
- **Auth must stay on capucor.app.** A Supabase session cookie set on one eTLD+1 is unreachable
  from the other — the two domains can never share a login. That is why `/login` and
  `/onboarding` live in the **`app/(app)/`** route group with their own slim shell, not in
  `app/(site)/`. Route groups don't change URLs, so `/login/callback` is unmoved and the Supabase
  redirect allowlist (`https://capucor.app/**`) needs no change.
- **A new public/marketing page needs a line in `MARKETING_PATHS`** in `next.config.ts`, or it
  will also answer on capucor.app. The list is explicit on purpose — a negative-lookahead
  catch-all would redirect `/_next/static/*` and `/brand/*` off the app domain and strip the CSS
  and logo from every portal page. Forgetting an entry fails gracefully; the `noindex` header
  stops it being indexed as duplicate content.
- **Never add an `/api/*` host redirect.** The API is genuinely dual-host: `/pricing` on
  capucor.com posts to `/api/proposals`, while `/internal/proposals/[id]/amend` on capucor.app
  posts to `/api/proposals/amend`.
- **Links that cross domains must be absolute** (`siteConfig.appUrl` / `siteConfig.marketingUrl`) —
  the Navbar's Client Portal CTA, the portal's "Back to website", the proposal page's
  "Sign in to your portal". Links within one domain stay relative so client-side nav still works.

Verify the table after any change to it — build, then `npx wrangler dev --port 8787 --local` and
fake the host:

```bash
curl -sI -H "Host: capucor.app" http://localhost:8787/pricing   # 308 → https://capucor.com/pricing
curl -sI -H "Host: capucor.com" http://localhost:8787/portal    # 308 → https://capucor.app/portal
curl -sI -H "Host: capucor.app" http://localhost:8787/brand/logo-dark.png  # 200 — never redirected
curl -sI -H "Host: capucor.app" http://localhost:8787/api/proposals        # never redirected
```

Cloudflare-side: all four hostnames (both apexes + both `www`s) are bound to the single
`capucor-web` Worker. ⚠️ **Never delete the capucor.com zone or its MX / SPF / `resend._domainkey`
DKIM / DMARC records** — capucor.com is the verified Resend *sender* domain, and removing them
kills every transactional email while the site keeps looking fine.

## Database (Supabase)

Migrations live in `supabase/migrations/`. Apply them via the Supabase dashboard SQL editor or the Supabase CLI:

```bash
supabase db push     # Push local migrations to remote project
```

After any schema change, regenerate TypeScript types:

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
- **`createSupabaseServerClient()` (`server.ts`) — for per-user/auth reads.** Cookie-bound; adopts
  the visitor's session role. Use for auth, the client portal, and lead/data-request inserts.
- **`createSupabaseAdminClient()` (`admin.ts`) — for privileged writes.** Service-role; bypasses
  RLS. Server-only mutations (provision-on-sign, Karbon/Xero sync, portal writes). Never import
  into browser code.

⚠️ **The public pricing tables only grant `select to anon`** (see `001_schema.sql`; no
`to authenticated` policy). Reading them via the cookie-bound server client means a **signed-in**
visitor runs as `authenticated`, matches no policy, and silently gets **zero rows** (no error) —
which renders the calculator unavailable for logged-in users only. Always read public data with
`createSupabaseAnonClient`.

## Project Structure

```
src/
├── app/              # Next.js App Router pages and API routes
├── components/
│   ├── landing/      # Homepage sections (Hero, ProblemCards, etc.)
│   ├── pricing/      # Multi-step pricing calculator
│   ├── ui/           # shadcn + custom UI primitives
│   ├── layout/       # Navbar, Footer
│   ├── portal/       # Client portal components
│   └── services/     # Service page components
├── config/           # siteConfig, tier config
├── hooks/            # usePricingState, useCursorGlow
├── lib/              # utils, pricing logic, Supabase clients, validations
└── types/            # TypeScript interfaces
```

### App Router layouts (route-group topology, PR11)

The root `app/layout.tsx` is a **bare shell** — `<html>` + fonts + `globals.css` + the default
metadata only, no chrome. Chrome is applied per area by nested layouts:

- **`app/(site)/layout.tsx`** — marketing chrome (Navbar + Footer). **All public pages live in the
  `(site)` route group** (home, services, pricing, privacy, terms, resources).
  Route groups don't change the URL, so **a new public/marketing page goes in `app/(site)/`, not
  `app/`.**
- **`app/(app)/layout.tsx`** — slim shell (logo header only) for the Capucor OS entry points that
  sit outside `/portal` and `/internal`: `/login` (+ `/login/callback`) and `/onboarding`. These
  are served from capucor.app, so they must not wear marketing chrome — see the domain seam above.
- **`app/proposal/layout.tsx`** — bare, no chrome (the standalone signing document).
- **`app/portal/layout.tsx`** — slim app bar (logo, "Back to website", sign-out). Pages gate auth
  themselves via `requireSession()`.
- **`app/internal/layout.tsx`** — `requireInternal` gate + `InternalNav`.

Root `not-found.tsx` / `error.tsx` stay at `app/` root and render bare (the global 404 has no
marketing chrome by design).

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

### Client portal surfaces

- **The client portal does not use the marketing `premium-section` / `SectionDivider`
  rhythm.** It is a card-based app surface, not a scroll of marketing sections. Pages set
  their own `max-w-* mx-auto px-6 py-12 lg:py-16` container.
- **Use the shared card constants in `components/portal/portalCard.ts`, not ad-hoc classes:**
  `PORTAL_CARD` (`.premium-card` — the glassy surface *with* the `@media all` hover lift) for
  clickable cards/tiles/link rows, and `PORTAL_PANEL` (`.premium-glass` — same surface, no
  lift) for static information panels. Both already include `rounded-xl border border-white/10
  bg-card/80`; add your own padding.
- Sub-pages share [`PortalPageHeader`](src/components/portal/PortalPageHeader.tsx) (icon-led
  title + back link + org label). The portal hub is `app/portal/page.tsx`.
- **The hub's header building blocks are extracted as presentational components reused by the
  `/internal` view-only client mirror so the two can't drift:**
  [`PortalSummaryHeader`](src/components/portal/PortalSummaryHeader.tsx) (tier + subscription-status
  badges + monthly + first/next payment — pass `heading`/`orgLabel` on the portal; omit both on
  the mirror, where the org name/status already sit in the layout header),
  [`PortalQuickActions`](src/components/portal/PortalQuickActions.tsx) (icon-tile link row — the
  page supplies the per-audience `href`s), and
  [`PortalKeyDatesWidget`](src/components/portal/PortalKeyDatesWidget.tsx) (the shared SARS
  calendar; `seeAllHref` is optional — the mirror has no dates tab).
  [`PortalFinanceSnapshot`](src/components/portal/PortalFinanceSnapshot.tsx) takes an optional
  `href` (default `/portal/finance`) so the mirror points at its own finance tab. The **page**
  fetches the data and picks the Supabase client (portal → admin; mirror → session/RLS); these
  components stay purely presentational.
- The shared views `BillingView` / `FinanceView` / `DocumentsView` take a `surface` prop:
  `'glass'` is the premium glassy look, `'flat'` the legacy plain cards. **Both the client portal
  and the `/internal` mirror now pass `'glass'`** (the mirror was brought to visual parity in the
  Session-6 pass; its Proposals tab is wrapped in a `PORTAL_PANEL`). The prop defaults to `'flat'`
  and is kept for safety/flexibility — don't remove it or glassify those components unconditionally.

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

(The client portal and `/onboarding` are **live**, not stubs — provision-on-sign and the auth flow
shipped.)

## Pending Content: Client Testimonials / Social Proof

The slot reserved for **real client testimonials / social proof** sits between the **What we do** (`ServicePillars`) and **Packages** (`PackagesTeaser`) sections. Its previous occupant — the "A Month with Capucor" four-week timeline (`OutcomeStories.tsx`) — was removed.

- Placement: `src/app/(site)/page.tsx`, between `ServicePillars` and `PackagesTeaser` (look for the placeholder HTML comment). The homepage FAQ was retired and its `FaqAccordion` + `config/faq.ts` removed; rebuild fresh if a FAQ section is wanted later.
- Blocker: testimonials still need to be collected from clients. Once 3–5 quotes (name, role, company, quote, ideally a headshot) are in hand, build a new `Testimonials.tsx` landing component and slot it in.
- Do not ship the old four-week timeline visual back — it was scrapped intentionally. Build fresh around the real quotes.
