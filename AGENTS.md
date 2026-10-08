<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

> **Canonical agent instructions for Capucor Web.** Every agent — Claude, Gemini, Codex,
> Antigravity, Cursor, and any future tool — should read this file. `CLAUDE.md` and `GEMINI.md`
> are thin pointers to it; **edit this file, not them.**

> ⚠️ **Status 2026-10-07.** This repo is a stand-alone product: the site, the pricing calculator
> and the whole proposal funnel (web-standalone, 2026-10-07). Planning, decisions and cross-product
> brand/voice knowledge live in the owner's private workspace. `capucor-docs` is archived
> (read-only); paths into it that remain in these docs are historical references, not live rules.

# Capucor Web — Project Reference

Capucor Business Solutions public website and sales funnel — capucor.com. South African outsourced
accounting firm targeting modern SMEs. Deployed to Cloudflare Workers via OpenNext.

**This repo is capucor.com: the site and the sales funnel, end to end** (calculator → proposal →
email → sign → `signed` + PDF in Drive). It has no login, portal or staff area; old portal paths
only redirect away (see "Domain seam" below).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React Server Components) |
| UI | React 19, Tailwind CSS v4, shadcn/ui (Base Nova) |
| Database | Supabase (PostgreSQL); no auth here (no login since 2026-08-02) |
| Forms | React Hook Form + Zod |
| Email | Resend |
| Payments | Subscriptions: Paysoft Flow debit orders (Xero-integrated, manual — no API). Shop one-offs: PayFast (not yet wired) — see "Payments status" below. |
| Deployment | Cloudflare Workers via opennextjs-cloudflare |
| Testing | Vitest |

⛔ **The `shadcn` CLI is deliberately NOT a dependency** (removed 2026-09-04; it carried 30 of
this repo's 39 Dependabot advisories and no release clears them). `components.json` stays, the
required CSS is vendored into `src/app/globals.css`, and a component is added with
`npx shadcn@latest add` — do not reinstall the package. See
[`docs/deploy.md`](docs/deploy.md#-adding-a-shadcn-component-now) for the check that follows.

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
| `NEXT_PUBLIC_MARKETING_URL` / `NEXT_PUBLIC_APP_URL` | Optional. Defaults are the production values (`https://capucor.com` / `https://capucor.app`) — override only for a staging host. `NEXT_PUBLIC_APP_URL` feeds `siteConfig.appUrl`, unused since the header's Client Portal link was removed (2026-10-08) |
| `APPS_SCRIPT_PDF_URL` / `APPS_SCRIPT_PDF_SECRET` | Signed-proposal PDF archival (PR10/PH-06). Apps Script web-app `/exec` URL + its shared secret. Archival does not run until both are set. See `scripts/apps-script/README.md` |

## Dev Scripts

```bash
npm run dev          # Start dev server with Turbopack (http://localhost:3000)
npm run lint         # ESLint over src/
npm run build:cf:offline  # Full OpenNext/Cloudflare build with NO credentials — see docs/deploy.md
npm run test         # Run Vitest unit tests
npm run test:watch   # Vitest in watch mode
npm run test:ui      # Open Vitest browser UI
npm run db:types     # Regenerate src/types/db.ts from the live schema (needs `npx supabase login`)
```

`src/types/db.ts` is **generated in this repo** (since 2026-10-07): after Zjak applies a funnel
migration, run `npm run db:types` and commit the result. See
[`docs/database.md`](docs/database.md#types).

## Build and deploy (Cloudflare)

⛔ **[`docs/deploy.md`](docs/deploy.md) — read it before deploying.** Every rule on that page is
there because ignoring it has taken production down.

The four that bite hardest: **production ships by MANUAL DISPATCH ONLY**, so merging to `master`
ships nothing and a merged fix is not a shipped fix; **never run `npm run deploy:cf` from the
Windows dev box**, which produces a worker that throws `ChunkLoadError` on every server route;
the build is **pinned to webpack** because OpenNext cannot bundle a Turbopack build; and Next,
`@opennextjs/cloudflare` and Wrangler are **pinned exact and move together**. Recovery from a bad
deploy is `wrangler rollback`.

## Domain seam — capucor.com only

**This repo is capucor.com only.** Marketing and the whole sales funnel — including
`/proposal/*`, the signing document — live here. The only things left pointing at capucor.app
(the legacy client portal) are kept until os-sunset: the `APP_PATHS` redirects in
`next.config.ts` (`/portal`, `/login`, `/internal`, `/onboarding`, `/client-portal`). The header's
Client Portal link was removed 2026-10-08 (its button now books a fit call). Nothing else here reads,
writes or links it.

⛔ **[`docs/domain-seam.md`](docs/domain-seam.md) — the redirects, and four operational
contracts filed under it.** Read it before touching the redirect table, a cron, a route handler
that reads a body, or anything that sends email.

- **Signing stops at `signed` + the signed PDF in Drive** (web-standalone phase 3, migration
  `001`): fulfilment is pdf → client email → owner email (with the Drive link). Nothing here
  writes a portal table; `proposals.client_org_id` is left unused until os-sunset.
- **Web contract** — exact version pins, the redirect table and the declared crons live in
  `contracts/web-contract.json`, checked by `npm test`. It is web-owned: pricing, tiers, emails
  and `db.ts` are this repo's files and nothing is compared with another repository.
- **Retries run here.** `cron-reconcile-deliveries.yml` (zero-dependency
  `scripts/reconcile-deliveries.mjs`) finishes fulfilment and resends failed funnel emails,
  rebuilt from `src/lib/email/messages.mjs` under the original idempotency key. It runs from
  `master`, so deploy soon after merging a `messages.mjs` change.
- **Scheduled workflows** — an undeclared cron is a job nothing watches, and `npm test` fails.
- ⚠️ **Never call `req.json()` in a route handler** — it is unbounded. Use
  `readJsonBody(req, MAX_BODY_BYTES)`.
- **Every transactional send in the Worker goes through `src/lib/email/sendEmail.ts`.** Never
  construct `Resend` elsewhere; the retry runner is the only other sender, under the same
  contract. `accepted` means the provider took the request, not that anyone received it.
- ⚠️ **Never delete the capucor.com zone or any of its DNS records** — several are load-bearing for
  services beyond this website and break silently while the sites keep looking fine.

## Database (Supabase)

capucor.com shares **one Supabase project** with the legacy portal. ⚠️ **Since 2026-10-07 this repo owns the sales-funnel
schema** (`leads`, `proposals`, `brackets`, `services`, `tiers`, `testimonials`, `data_requests`,
`proposal_fulfilment`, `email_deliveries` and the signing/fulfilment functions). **New funnel
migrations are written in this repo's [`supabase/migrations/`](supabase/migrations/) only.**
Portal tables are not this repo's; what still crosses the line is in `docs/database.md`.
`supabase/migrations/000_baseline_funnel.sql` records the live starting state and is ⛔ **never
applied**.

⛔ **[`docs/database.md`](docs/database.md) — read it before any Supabase call.** Three things
there are load-bearing:

- ⛔ **Migrations are applied BY HAND by Zjak in the Supabase SQL editor. No agent applies one, by
  any route.**
- ⛔ **Never use `supabase db push`.** The remote migration ledger has drifted from production, so
  a push would replay already-applied migrations.
- ⚠️ **Picking the wrong Supabase client causes silent data loss, not an error.** The public
  pricing tables grant `select` to `anon` only, so reading them with the cookie-bound server
  client returns **zero rows and no error** for a signed-in visitor.

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
├── hooks/            # usePricingState, useCursorGlow, use3DTilt, useSectionScrollProgress
├── lib/              # utils, pricing logic, Supabase clients, validations
│   ├── log.ts        # structured one-line-JSON logging into Workers Logs.
│   │                 #   Use logError/logWarn/logInfo, not console.*; `evt` is a
│   │                 #   stable dotted id you can query on in the Cloudflare
│   │                 #   dashboard.
│   ├── portal/       # ⚠️ NAME IS HISTORICAL — this is the SIGNING half, not a portal:
│   │                 #   finalizeSign, fulfilment, proposalPdf (+ proposalPdfPayload),
│   │                 #   proposalJson, signEmails, reconciliationAuth (the retry
│   │                 #   runner's PDF bridge).
│   └── proposal/     # Proposal document rendering (HTML → PDF, inlined logo)
└── types/            # TypeScript interfaces
```

**Pricing** lives in `src/lib/pricing.ts`, `src/lib/proposalPricing.ts` (server re-pricing) and
`src/config/tiers.ts`; bracket figures are rows in the Supabase `brackets` table (a price change
is new rows, never an edit). `src/__tests__/pricing-decisions.test.ts` locks each pricing decision
to the code: change a rule there only when the decision changes.

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

There are no `(app)`, `portal/` or `internal/` route groups here (removed 2026-08-02). Two route
groups remain, `(site)` and the bare `proposal/`.

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

## Design system and UI conventions

⛔ **[`docs/design-system.md`](docs/design-system.md) — read it before writing any UI.** Several of
its rules describe **silent failures**, not preferences: Tailwind `hover:` utilities do not
reliably emit here so hover effects written inline **never render**; gating hover on
`(hover: hover)` **kills the effect** on Windows hybrid laptops; `p-4 sm:p-5 pr-12` **silently
drops the right padding** at `sm+`; and a subgrid row must be reserved even when a card has
nothing to put in it, or peer cards stop aligning.

It also carries the section rhythm (`premium-section` + `SectionDivider`), price display, and the
**voice and copy** essentials — whose full guide is [`docs/voice-and-copy.md`](docs/voice-and-copy.md).
⚠️ **Neither owns Capucor brand voice**: the canonical cross-product standard is the brand
voice-and-content page in the owner's private workspace (migrated from the archived
`capucor-docs/rules/brand-voice-and-content.md`), and it wins on anything shared.

## Payments status

⛔ **[`docs/payments.md`](docs/payments.md) — read it before touching payment code.** The billing
model changed on 2026-06-17 and the shape of the code changed with it.

**Subscriptions** are collected via **Paysoft Flow**, which has **no developer API** — billing is
set up by hand, the signed proposal is the debit-order mandate, and **no banking details are captured on
the site**. Signing stops at `signed` + the signed PDF in Drive; the owner email is the cue to
set up billing.
**Shop one-offs** will use **PayFast**, not yet wired. ⛔ **There is no Paystack code here and none
of it is worth resurrecting** — the shop needs PayFast's ITN/MD5 scheme, not Paystack's HMAC.

## Pending content

⛔ **[`docs/pending-content.md`](docs/pending-content.md).** A homepage slot between **What we do**
and **Packages** is reserved for real client testimonials, blocked on collecting 3–5 quotes. ⚠️ **Do
not ship the old four-week timeline visual back** — it was scrapped intentionally.
