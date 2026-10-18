<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

> **Canonical agent instructions for Capucor Web.** Every agent — Claude, Gemini, Codex,
> Antigravity, Cursor, and any future tool — should read this file. `CLAUDE.md` and `GEMINI.md`
> are thin pointers to it; **edit this file, not them.** Keep it lean: reference detail goes in
> `docs/`, loaded on demand.

> ⚠️ **Status 2026-10-07.** This repo is a stand-alone product: the site, the pricing calculator
> and the whole proposal funnel (web-standalone, 2026-10-07). Planning, decisions and cross-product
> brand/voice knowledge live in the owner's private workspace. `capucor-docs` is archived
> (read-only); paths into it that remain in these docs are historical references, not live rules.

# Capucor Web — Project Reference

Capucor Business Solutions public website and sales funnel — capucor.com. South African outsourced
accounting firm targeting modern SMEs. **This repo is the site and the sales funnel, end to end**
(calculator → proposal → email → sign → `signed` + PDF in Drive). It has no login or client
portal; old portal paths only redirect away (see "Domain seam" below). Since 2026-10-15 it also
serves **internal.capucor.com**, a staff-only proposal tool behind Cloudflare Access (plan
reviews); ⛔ every internal page/API calls the gate in `src/lib/internal/guard.ts` — there is no
proxy.ts — and it must not grow into practice-management software. See
[`docs/domain-seam.md`](docs/domain-seam.md#internalcapucorcom--the-staff-only-host).

**Stack:** Next.js 16 (App Router, RSC) · React 19 · Tailwind CSS v4 + shadcn/ui (Base Nova) ·
Supabase (PostgreSQL, no auth here) · React Hook Form + Zod · Resend · Cloudflare Workers via
OpenNext · Vitest. Node 24 (`.nvmrc` and CI in step).

## Read before you start

| Doing… | Read first |
|---|---|
| Local setup, env vars, npm scripts, source layout, route groups, self-review checklist | [`docs/setup.md`](docs/setup.md) |
| Deploying, or touching build config or dependency pins | [`docs/deploy.md`](docs/deploy.md) |
| Any Supabase call or migration | [`docs/database.md`](docs/database.md) |
| Redirects, a cron, a route handler that reads a body, anything that sends email | [`docs/domain-seam.md`](docs/domain-seam.md) |
| Any UI | [`docs/design-system.md`](docs/design-system.md); copy: [`docs/voice-and-copy.md`](docs/voice-and-copy.md) |
| Payment code | [`docs/payments.md`](docs/payments.md) |
| Homepage content slots | [`docs/pending-content.md`](docs/pending-content.md) |

Checks before a PR: `npm run lint`, `npm test`, `npm run build:cf:offline` (credential-free
OpenNext build).

## Build and deploy (Cloudflare)

⛔ Every rule in `docs/deploy.md` is there because ignoring it has taken production down. The four
that bite hardest: **production ships by MANUAL DISPATCH ONLY**, so merging to `master` ships
nothing and a merged fix is not a shipped fix; **never run `npm run deploy:cf` from the Windows
dev box** (the worker throws `ChunkLoadError` on every server route); the build is **pinned to
webpack** (OpenNext cannot bundle Turbopack); and Next, `@opennextjs/cloudflare` and Wrangler are
**pinned exact and move together**. Recovery from a bad deploy is `wrangler rollback`.

⛔ **The `shadcn` CLI is deliberately NOT a dependency** (it carried most of the Dependabot
advisories). Add a component with `npx shadcn@latest add`; never reinstall the package. See
[`docs/deploy.md`](docs/deploy.md#-adding-a-shadcn-component-now).

## Domain seam — capucor.com only

The only things still pointing at capucor.app (the legacy portal) are the `APP_PATHS` redirects in
`next.config.ts`, kept until os-sunset. Nothing else here reads, writes or links it.

- **Signing stops at `signed` + the signed PDF in Drive:** pdf → client email (signed PDF
  attached) → owner email (Drive link). Nothing here writes a portal table.
- **Web contract** — exact version pins, the redirect table and rule wording live in
  `contracts/web-contract.json`, checked by `npm test`.
- **Scheduled workflows** — lead prune and proposal expiry (daily), retries (every ten minutes in
  weekday business hours, hourly otherwise) via `cron-reconcile-deliveries.yml`, which rebuilds
  emails from `src/lib/email/messages.mjs` (proposal lines from `src/lib/pricing.ts` and
  `src/config/tiers.ts`) and runs from `master`: deploy soon after merging a change to any of
  them. In business hours one run stays up and loops (GitHub drops most
  scheduled runs). No watchdog, except that the retry runner fails from 45 days without a commit
  (GitHub disables schedules at 60); any other silent stop is not detected.
- ⚠️ **Never call `req.json()` in a route handler** — use `readJsonBody(req, MAX_BODY_BYTES)`.
- **Every transactional send goes through `src/lib/email/sendEmail.ts`.** Never construct
  `Resend` elsewhere. `accepted` means the provider took it, not that anyone received it.
- ⚠️ **Never delete the capucor.com zone or any of its DNS records** — several serve more than
  this website and break silently.

## Database (Supabase)

One Supabase project, shared with the legacy portal. **This repo owns the sales-funnel schema**
(since 2026-10-07); new funnel migrations go in [`supabase/migrations/`](supabase/migrations/)
only. `000_baseline_funnel.sql` records the live starting state and is ⛔ **never applied**.
`src/types/db.ts` is generated here (`npm run db:types`) after a migration is applied.

- ⛔ **Migrations are applied BY HAND by Zjak in the Supabase SQL editor. No agent applies one, by
  any route.**
- ⛔ **Never use `supabase db push`.** The remote migration ledger has drifted from production.
- ⚠️ **The wrong Supabase client causes silent data loss, not an error.** Public pricing tables
  grant `select` to `anon` only; the cookie-bound server client returns zero rows, no error.

**Pricing** lives in `src/lib/pricing.ts`, `src/lib/proposalPricing.ts` and
`src/config/tiers.ts`; bracket figures are rows in `brackets` (a price change is new rows, never
an edit). `src/__tests__/pricing-decisions.test.ts` locks each pricing decision to the code.

## Design system and UI conventions

⛔ Several rules in `docs/design-system.md` describe **silent failures**: inline Tailwind `hover:`
effects **never render**; gating hover on `(hover: hover)` kills it on Windows hybrid laptops;
`p-4 sm:p-5 pr-12` drops the right padding at `sm+`; a subgrid row must be reserved even when
empty. A new public page goes in `app/(site)/`, not `app/`. ⚠️ The canonical brand guide (voice, logo,
colours, card types, brand rules) is in the owner's private workspace; it wins on anything shared.

## Payments status

**Subscriptions** use **Paysoft Flow** (no API): billing is set up by hand, the signed proposal is
the debit-order mandate, and **no banking details are captured on the site**. **Shop one-offs**
will use **PayFast**, not yet wired. ⛔ No Paystack code, and none worth resurrecting.

## Pending content

A homepage slot between **What we do** and **Your first 90 days** is reserved for real client
testimonials (blocked on 3–5 quotes). ⚠️ **Do not ship the old four-week timeline visual back.**

## Maintenance

Keep this file accurate, agent-neutral and under ~150 lines. Review after significant changes or
about every 5 days (Claude: `/self-review`; others: the checklist in
[`docs/setup.md`](docs/setup.md#maintenance--self-review)).
