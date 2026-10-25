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

### Brand rules come first

Brand decisions (logo files, colours, type, card types, the rules below) are owned by the
**Capucor brand guide** in the owner's private workspace (`domains/capucor/wiki/brand/`, named in
prose because a cross-repository link would not resolve). This file owns how the site
implements them. When the two disagree, the brand guide wins and this file or the code is fixed
(Zjak, 2026-10-17). Brand rules adopted 2026-10-17:

- **One accent colour per view.** Cyan (`--primary`) marks "act here" or "look here", never
  decoration.
- **At most one gradient button (`gradient-cta`) per screen-height.** Everything else nearby is
  the outline button or a link.
- **Section sub-headers stay within two lines on desktop.**
- **No uppercase eyebrow labels** above headings (decided 2026-10-08).

### Type scale and control sizes (design review 2026-10-25, A4 / I1)

- **One heading scale**, as tokens in `globals.css`: `text-h1` 40 / `text-h2` 36 (section
  headings, via `SectionHeading`) / `text-h3` 22 (card titles) / `text-h4` 17 px; the hero sets
  its own display size. **Titles are `font-semibold`**, never `font-bold` (bold stays for prices).
  A card title never outranks its section heading.
- **Controls are conversion-sized** through the shared variants, not per call site: `Button`
  default 44 px, `lg` 48 px for the primary action of a view (and the buttons in the same row),
  `sm` 36 px only where space is tight; `Input` and `SelectTrigger` 44 px. The internal tool has
  its own controls and keeps 36 px.
- **A disabled primary is neutral** (`.btn-primary:disabled` in `globals.css`), not a dim cyan.
- **Arrows are Lucide icons** (`ArrowRight` / `ArrowLeft`), never the "→" / "←" glyphs.

### Section rhythm

- Standard content sections use `className="premium-section py-14 lg:py-20"`. Hero and the
  final CTA run heavier (`py-20`/`24`/`28`/`36`); match a neighbouring section rather than
  inventing new spacing. Examples: `ProblemCards`, `ServicePillars`,
  `HowItWorks`.
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
components) left with the code on 2026-08-02 and do not apply here.

**Everything below this line is marketing design guidance and still applies here.** The one portal
rule worth remembering on this side: the app surface deliberately does *not* use the
`premium-section` / `SectionDivider` rhythm — so don't reach for the old portal as a precedent when
building a marketing section.

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

### Motion and first paint

- **Animate `transform` and `opacity` only.** `left`/`top`/`height`/`width` animations cost
  layout every frame and count as layout shift; a `filter` animation cannot run on the
  compositor, so it stalls behind hydration. Measured on the hero (2026-10-08): the blurred-in
  headline painted up to 1.9 s after the buttons on a phone. See `HeroStory.tsx` and the
  "Hero story beats" block in `globals.css`.
- **Above-the-fold copy is final in the server HTML**: no `opacity: 0` or `filter` starting
  frame on a headline or primary button.
- **The one `filter` exception: section headings type in letter by letter below the fold**
  (`TypedHeading` / `.heading-type`, used by `SectionHeading` and `FinalCTA`, armed by
  `RevealObserver`; replaced a whole-heading blur-in, Zjak, 2026-10-12). Each letter fades, lifts
  and, from `sm` up, sharpens from a 6px blur; phones (<640px) get no blur. Headings on screen at
  load are marked revealed first, so they never re-type. Don't extend it to body copy or above the fold.
- **Smooth wheel scrolling is Lenis** (`SmoothScroll` in `app/(site)/layout.tsx`). Touch stays
  native, it is off under reduced motion, and `html.lenis` turns off the CSS `scroll-behavior: smooth`
  so the two don't fight. Anchor jumps are offset 80px for the sticky navbar.
- Word-by-word "scroll-lit" text was tried on section intros and rejected (Zjak, 2026-10-12):
  intros stay plain.
- **Layout that differs by screen size is CSS, not a `matchMedia` switch in React.** The server
  renders the desktop branch, so a JS switch makes phones jump after hydration.
- Loops pause off-screen, and phones get a calmer cut rather than a smaller one (no drift, no
  backdrop blur). The exception is the hero's chaos beat: on a phone (<640px) it keeps every
  desktop piece so the chaos is felt, with the three meant to be read landing on top at 13px or
  more, on the desktop timeline (F07, Zjak, 2026-10-13). `hero-phone.test.ts` checks it and that
  desktop is unchanged.
- **Cards that stack as you scroll:** reuse `useCardDeck` (`hooks/useCardDeck.ts`) with `.stack-deck` /
  `.stack-card` in `globals.css`.
  It handles centring, equal heights, phones shorter than a card and the dim. Add `.stack-deck-phone` to
  stack on phones only (a grid from `sm` up). Used by `ProblemCards` (phone only) and
  `FirstNinetyDays`. Test phone fits at real browser heights (~660px), not the 812px preset.

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
  vary only the icon and copy, keep the styling byte-identical. Example: the package cards
  (`components/pricing/Step2Tiers.tsx`) each carry the same `.svc-icon` lockup, differing
  only in icon and name. The one deliberate exception: the featured package (Pro) gets the
  lit border and the "Recommended" badge.
- **Package cards borrow the service cards' language** (`ServicePillars.tsx`, Zjak
  2026-10-13): glass surface, icon-and-title lockup, a lit top edge, `.svc-check` ticks, and
  hairline-divided sections ending in a footer action row.

### Price display

- Show the amount and the period (`/month`) on one baseline-aligned row: the period is a
  small `whitespace-nowrap` subtext to the right of the price, never stacked below it and
  never allowed to wrap. Use `AnimatedPrice` for ZAR amounts (handles the animated count-up,
  the `R` glyph, tabular nums, and reduced-motion). See the price block in `Step2Tiers.tsx`.
- Prices read **"R 5 750"**: a space between thousands, no cents (decided 2026-10-13, on
  every surface). Never format a price by hand: use `formatZAR` / `formatZARNumber`
  (`src/lib/utils.ts`), or `formatZAR` in `src/lib/email/messages.mjs` for emails. Both
  spaces are no-break spaces (U+00A0), so a price cannot wrap even without `whitespace-nowrap`.
  The hero's bank statement and slips keep statement style ("R 42 000.00"): they depict
  documents, not Capucor prices.

### Voice & copy (applies to all UI text)

Plain, direct, human. The rules below are the essentials; the **full website guide**
(complete banned-vocab list, ✅/❌ examples, South African specificity, sample copy) lives in
[`docs/voice-and-copy.md`](./voice-and-copy.md) — read it before writing or reviewing
user-visible copy.

⚠️ **Neither this section nor that guide owns Capucor brand voice.** The canonical
cross-product standard is the brand voice-and-content page in the owner's private workspace
(migrated from `capucor-docs/rules/brand-voice-and-content.md`; `capucor-docs` is archived and
read-only). Named in prose — a relative link across repositories would not resolve. It governs shared brand rules; the website guide governs capucor.com implementation
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
