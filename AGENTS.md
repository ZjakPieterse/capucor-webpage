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
| `APPS_SCRIPT_PDF_URL` / `APPS_SCRIPT_PDF_SECRET` | Signed-proposal PDF archival (PR10/PH-06). Apps Script web-app `/exec` URL + its shared secret. Archival does not run until both are set. See `scripts/apps-script/README.md` |

## Dev Scripts

```bash
npm run dev          # Start dev server with Turbopack (http://localhost:3000)
npm run lint         # ESLint over src/
npm run build:cf:offline  # Full OpenNext/Cloudflare build with NO credentials — see docs/deploy.md
npm run test         # Run Vitest unit tests
npm run test:watch   # Vitest in watch mode
npm run test:ui      # Open Vitest browser UI
npm run db:types     # Regenerate Supabase TypeScript types → src/types/db.ts
```

## Build and deploy (Cloudflare)

⛔ **[`docs/deploy.md`](docs/deploy.md) — read it before deploying.** Every rule on that page is
there because ignoring it has taken production down.

The four that bite hardest: **production ships by MANUAL DISPATCH ONLY**, so merging to `master`
ships nothing and a merged fix is not a shipped fix; **never run `npm run deploy:cf` from the
Windows dev box**, which produces a worker that throws `ChunkLoadError` on every server route;
the build is **pinned to webpack** because OpenNext cannot bundle a Turbopack build; and Next,
`@opennextjs/cloudflare` and Wrangler are **pinned exact and move together**. Recovery from a bad
deploy is `wrangler rollback`.

## Domain seam — capucor.com vs capucor.app

**Two domains, two repos, two Cloudflare Workers. This repo is capucor.com only.** Marketing and
the whole sales funnel — including `/proposal/*`, the signing document — live here. `/login`,
`/onboarding`, `/portal/*` and `/internal/*` are **Capucor OS**, a separate repo and Worker on
capucor.app.

> **Working on the portal, `/internal`, login, or anything a signed-in user sees? Wrong repo — go
> to [`../capucor-os/AGENTS.md`](../capucor-os/AGENTS.md).**

⛔ **[`docs/domain-seam.md`](docs/domain-seam.md) — the seam itself, and four operational
contracts filed under it.** Read it before touching the redirect table, provisioning, a cron, a
route handler that reads a body, or anything that sends email.

- ⚠️ **The schema seam is the one that breaks silently.** `supabase/migrations/` lives in
  `../capucor-os` and nowhere else, but marketing still starts provisioning at signing. **A change
  on the capucor-os side breaks this repo's provisioning path with no compile error and no failing
  test here.**
- **Cross-repo contract** — change a hand-synced file or a pinned version and you must change the
  manifest in all three copies, or CI goes red naming the counterpart.
- **Scheduled workflows** — an undeclared cron is a job nothing watches, and the audit fails.
- ⚠️ **Never call `req.json()` in a route handler** — it is unbounded. Use
  `readJsonBody(req, MAX_BODY_BYTES)`.
- **Every transactional send goes through `src/lib/email/sendEmail.ts`.** Never construct
  `Resend` elsewhere; `accepted` means the provider took the request, not that anyone received it.
- ⚠️ **Never delete the capucor.com zone or any of its DNS records** — several are load-bearing for
  services beyond this website and break silently while the sites keep looking fine.

## Database (Supabase)

Both apps share **one Supabase project**, and ⚠️ **this repo does not own the schema** —
`supabase/migrations/` lives in [`../capucor-os`](../capucor-os/AGENTS.md) and nowhere else.

⛔ **[`docs/database.md`](docs/database.md) — read it before any Supabase call.** Two things there
are load-bearing:

- ⛔ **Migrations are applied BY HAND by Zjak in the Supabase SQL editor. No agent applies one, by
  any route.** The page carries the reasoning and the dated correction.
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

## Design system and UI conventions

⛔ **[`docs/design-system.md`](docs/design-system.md) — read it before writing any UI.** Several of
its rules describe **silent failures**, not preferences: Tailwind `hover:` utilities do not
reliably emit here so hover effects written inline **never render**; gating hover on
`(hover: hover)` **kills the effect** on Windows hybrid laptops; `p-4 sm:p-5 pr-12` **silently
drops the right padding** at `sm+`; and a subgrid row must be reserved even when a card has
nothing to put in it, or peer cards stop aligning.

It also carries the section rhythm (`premium-section` + `SectionDivider`), price display, and the
**voice and copy** essentials — whose full guide is [`docs/voice-and-copy.md`](docs/voice-and-copy.md).
⚠️ **Neither owns Capucor brand voice**: the canonical cross-product standard is
`capucor-docs/rules/brand-voice-and-content.md`, and it wins on anything shared.

## Payments status

⛔ **[`docs/payments.md`](docs/payments.md) — read it before touching payment code.** The billing
model changed on 2026-06-17 and the shape of the code changed with it.

**Subscriptions** are collected via **Paysoft Flow**, which has **no developer API** — provisioning
is manual, the signed proposal is the debit-order mandate, and **no banking details are captured on
the site**. Portal access is minted at signing by provision-on-sign, not by a payment webhook.
**Shop one-offs** will use **PayFast**, not yet wired. ⛔ **There is no Paystack code here and none
of it is worth resurrecting** — the shop needs PayFast's ITN/MD5 scheme, not Paystack's HMAC.

## Pending content

⛔ **[`docs/pending-content.md`](docs/pending-content.md).** A homepage slot between **What we do**
and **Packages** is reserved for real client testimonials, blocked on collecting 3–5 quotes. ⚠️ **Do
not ship the old four-week timeline visual back** — it was scrapped intentionally.
