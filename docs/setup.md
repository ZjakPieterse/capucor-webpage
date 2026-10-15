# Setup and code map — capucor.com

> Local setup, environment variables, dev scripts, the source layout and the self-review checklist.
> Extracted from `AGENTS.md` on 2026-10-14 to keep that file lean; the words are unchanged.
>
> Canonical agent instructions: [`../AGENTS.md`](../AGENTS.md).

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
| `CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD` | internal.capucor.com only. the team domain (`<team>.cloudflareaccess.com`) is shown in Zero Trust → Settings; the Access application's Overview shows its Application Audience (AUD) tag. Set as Worker variables (Settings → Variables and Secrets). Unset → every internal page 403s; the public site is unaffected |
| `CF_ACCESS_CERTS_URL` | Local preview only: a JWKS URL to use instead of the team's. Ignored when `NODE_ENV=production` |
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
[`database.md`](database.md#types).

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
  `(site)` route group** (home, services, pricing, contact, privacy, terms, resources).
  Route groups don't change the URL, so **a new public/marketing page goes in `app/(site)/`, not
  `app/`.**
- **`app/proposal/layout.tsx`** — bare, no chrome (the standalone signing document).

Root `not-found.tsx` / `error.tsx` stay at `app/` root and render bare (the global 404 has no
marketing chrome by design).

- **`app/(internal)/internal-tools/`** — the staff-only internal.capucor.com (2026-10-15), bare
  chrome, noindex. Every page and layout calls `requireInternalPage()`; see
  [`domain-seam.md`](domain-seam.md#internalcapucorcom--the-staff-only-host).

There are no `(app)` or `portal/` route groups here (removed 2026-08-02), and `/internal` still
redirects to capucor.app on capucor.com. Three route groups: `(site)`, the bare `proposal/` and
`(internal)`.

## Maintenance & self-review

Keep this file and the project's reference surface accurate, agent-neutral, and lean. Re-run a
review after any significant change, or roughly every 5 days. **Any agent can do it** — with
Claude, run the `/self-review` skill; other agents follow this checklist directly:

- **Drift** — paths, npm scripts (vs `package.json`), commands, and env-var names in the docs
  still match the code; referenced files exist.
- **Agent-neutrality** — this `AGENTS.md` stays the canonical, self-contained source; `CLAUDE.md`
  / `GEMINI.md` remain thin pointers; no references to renamed/deleted files; operational rules
  (e.g. the deploy rules) live here, not only in an agent's private memory.
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
