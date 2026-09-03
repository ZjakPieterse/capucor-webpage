# Design system and UI conventions

> The load-bearing rules for the site's look and feel, with canonical examples cited inline. ⚠️ **Several of these describe silent failures** — hover utilities that never render, a Tailwind shorthand that drops padding, a subgrid row that must be reserved even when empty.
>
> Extracted from `AGENTS.md` on 2026-09-03 (EH-02); the words are unchanged.
>
> Canonical agent instructions: [`../AGENTS.md`](../AGENTS.md).

---

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
[`../capucor-os/AGENTS.md`](../../capucor-os/AGENTS.md).

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

Plain, direct, human. The rules below are the essentials; the **full website guide**
(complete banned-vocab list, ✅/❌ examples, South African specificity, sample copy) lives in
[`docs/voice-and-copy.md`](./voice-and-copy.md) — read it before writing or reviewing
user-visible copy.

⚠️ **Neither this section nor that guide owns Capucor brand voice.** The canonical
cross-product standard is `capucor-docs/rules/brand-voice-and-content.md` in the private
`capucor-docs` repository (named in prose — a relative link across repositories would not
resolve). It governs shared brand rules; the website guide governs capucor.com implementation
detail only, and loses to the standard on anything shared.

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
