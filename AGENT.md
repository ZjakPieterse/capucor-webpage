# Capucor Web — Project Reference

Capucor Business Solutions public website and client portal. South African outsourced accounting firm targeting tech-forward SMEs. Deployed to Cloudflare Workers via OpenNext.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React Server Components) |
| UI | React 19, Tailwind CSS v4, shadcn/ui (Base Nova) |
| Database & Auth | Supabase (PostgreSQL) |
| Forms | React Hook Form + Zod |
| Email | Resend |
| Payments | Paystack (Phase 2 — wiring in progress) |
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
npm run deploy:cf    # Build and deploy to Cloudflare Workers
```

The Cloudflare target is configured in `wrangler.jsonc` and `open-next.config.ts`.

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

## Project Structure

```
src/
├── app/              # Next.js App Router pages and API routes
├── components/
│   ├── landing/      # Homepage sections (Hero, FAQ, etc.)
│   ├── pricing/      # Multi-step pricing calculator
│   ├── ui/           # shadcn + custom UI primitives
│   ├── layout/       # Navbar, Footer
│   ├── portal/       # Client portal components
│   └── services/     # Service page components
├── config/           # siteConfig, tier config, FAQ data
├── hooks/            # usePricingState, useCursorGlow
├── lib/              # utils, pricing logic, Supabase clients, validations
└── types/            # TypeScript interfaces
```

## Design System & UI Conventions

These are the load-bearing rules for the site's look and feel. Follow them for all new
UI work so the front end stays visually consistent. Canonical examples are cited inline.

### Section rhythm

- Standard content sections use `className="premium-section py-14 lg:py-20"`. Hero and the
  final CTA run heavier (`py-20`/`24`/`28`/`36`); match a neighbouring section rather than
  inventing new spacing. Examples: `ProblemCards`, `ServicePillars`, `TechStackShowcase`,
  `PackagesTeaser`, `FaqAccordion`.
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
  `globals.css`, consumed by `Step3Tiers.tsx`).
- **Always reserve a row even when a card has no content for it** — render an invisible
  placeholder (`h-0 w-0 opacity-0 aria-hidden`) so the subgrid row still exists and the
  cards line up. See the `else` branch of the cumulative-label row in `Step3Tiers.tsx`.

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
  the `R` glyph, tabular nums, and reduced-motion). See the price block in `Step3Tiers.tsx`.

### Voice & copy (applies to all UI text)

- Plain, direct, human. **Banned vocab:** "best-in-class", "tech-forward", "cutting-edge",
  "seamless", "leverage", "robust", and similar marketing filler. **Banned structures:**
  em-dash overuse, "not just X, but Y" negative parallelism, triple-repetition ("always …,
  always …, always …" / "no …, no …, no …"). Write what the thing does, not how impressive
  it is. Headings are sentence case.

## Phase 2 Pending Items

The following are intentional stubs awaiting Paystack integration:

- `src/app/api/subscriptions/route.ts` — pricing math + Supabase insert
- `src/app/api/webhooks/paystack/route.ts` — webhook event handling
- `src/app/client-portal/page.tsx` — real auth + subscription fetch
- `src/app/onboarding/page.tsx` — real transaction verification

All TODOs are inline-documented in each file.

## Pending Content: Client Testimonials / Social Proof

The homepage section that used to live between Tech Stack (#7) and FAQ (#9) — formerly "A Month with Capucor" / `OutcomeStories.tsx` — has been removed and the slot is reserved for **real client testimonials / social proof**.

- Placement: `src/app/page.tsx` between `TechStackShowcase` and `FaqAccordion` (look for the placeholder HTML comment).
- Blocker: testimonials still need to be collected from clients. Once 3–5 quotes (name, role, company, quote, ideally a headshot) are in hand, build a new `Testimonials.tsx` landing component and slot it in.
- Do not ship the old four-week timeline visual back — it was scrapped intentionally. Build fresh around the real quotes.
