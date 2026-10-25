# Design review: capucor.com and the pricing funnel

**Date:** 2026-10-25 · **Build reviewed:** `master` at `5c34230` (after #171), local dev server
(`next dev`, port 3000) · **Reviewer stance:** external design director, pre-launch review ·
**Status:** review only; no code changed.

Screenshots referenced as `d01`…`d19` (desktop at 1280 × 800, `d01` at 1440 × 900, saved as
800 × 500 captures of a scaled pane), `m01`…`m11`
(phone 390 × 740) and `t01` (tablet 768 × 1024) are in [`design-review/`](design-review/).

---

## How this review was done, and its limits

- **Read first:** `AGENTS.md`, `docs/design-system.md`, `src/app/globals.css` (tokens, card and hover
  rules), every component in `src/components/pricing/`, and the decision trail in the owner's
  workspace (calculator reviews of 6 and 13 Oct, the 13 Oct full audit, brand rules of 17 Oct), so
  that nothing already decided is presented as an oversight. Where a recommendation reopens a past
  decision, it says so (see [Decisions this review challenges](#decisions-this-review-challenges)).
- **Walked in the browser:** homepage, `/accounting`, `/contact`, the whole calculator (accounting
  + VAT + payroll path → packages → add-ons → review → Accept modal with validation), at 1280,
  768 and 390 px. Selection, add-on toggles, quantity stepper, dropdowns, field validation and
  Escape were exercised with real clicks. Measurements (font sizes, element positions, ARIA) were
  read from the live DOM.
- **Not submitted:** no proposal was created and no form was sent (that writes to the database
  and sends email). So **the proposal page (`/proposal/[token]`), signing, the confirm page and the
  signed moment were reviewed from code only**, plus the "Proposal not found" state (`m10`).
- **Not judged:** motion and timing. The browser pane was backgrounded (`document.hidden` was
  true), which throttles animation, so step transitions looked blank for 1–2 s in screenshots.
  That is an artefact of the tool and is **not** reported as a defect. Hover could not be
  triggered reliably either. Real-device performance, the resource pages, privacy/terms pages,
  the internal tool and email/PDF templates were out of scope.

---

## Executive assessment

Capucor's site is **well above the typical accounting-firm website** and close to a credible
fintech product. The palette is disciplined on paper, the type (Geist) is right, prices are
formatted with care, the calculator is honest (no sign-up, real prices, edit-in-place answers),
validation and focus handling are better than most SaaS funnels, and the founder section is the
single most trust-building thing on the site. The decision log shows a team that iterates
deliberately.

What holds it back from *exceptional* is not missing polish but **missing hierarchy**:

1. **Everything is the same volume.** Every homepage section is the same template: centred 36 px
   heading, two-line muted intro, a row of glass cards with an icon tile, cyan accents and ticks.
   Cyan marks icons, taglines, ticks, labels, pills, borders and buttons, so it no longer marks
   "act here". The result reads as a very good dark SaaS template rather than a firm with a point
   of view.
2. **The funnel sells the price, not the service.** On the package step the most valuable things
   Capucor does (annual financials, SARS and CIPC, Xero, a finance team, year-round support) are
   compressed into one tick, "Core services included", identical on all three cards. Differences
   between packages are listed, the foundation is not. The review step then shows those same
   items expanded for the first time, after the choice is made.
3. **The decision moment is buried.** On the review step the Accept button is below the first
   screen on desktop and about 1.5 screens down on a phone, below a 10-line inclusions list,
   while the phone's sticky bar on that step shows a total with no action.
4. **Controls are dashboard-sized.** Buttons default to 36 px, inputs to 32 px (shadcn defaults
   built for dense apps). On a conversion surface, and on phones, that reads as lightweight and
   is below comfortable touch size.

None of these need new components or dependencies. They are composition and system decisions.

### Scores

| Dimension | Score | Why |
|---|---|---|
| Visual design quality | **7 / 10** | Strong palette, type and price display; coherent surfaces. Loses points for template sameness, an inverted heading scale on the homepage (h3 at 40 px under h2 at 36 px), and decorative use of the accent. |
| Premium brand perception | **6.5 / 10** | The founder story, SA-specific copy and restraint in motion feel premium. Glow-on-glass everywhere, red "The problem" labels, uniform icon tiles and small controls feel generic. Premium here would come from *less* treatment, not more. |
| UX and usability | **6.5 / 10** | Calculator mechanics are sound (auto-advance, answer recap, live total, good validation). But "a few quick questions" is 8–9 steps with no visible count, two dropdowns are long lists (100 employee options), and the decision point is below the fold. |
| Design consistency | **7 / 10** | Better documented than most products. Drift: four h3 sizes on one page, `font-bold` vs `font-semibold` titles, text arrows "→" beside Lucide arrows, Title Case add-on names under a sentence-case rule. |
| Mobile experience | **6 / 10** | Calm, no horizontal overflow, 16 px inputs (no iOS zoom), a good sticky total bar. But packages are three ~500–600 px cards in a column, the "side by side" table becomes three more stacked lists, the review step's sticky bar has no action, and many targets are 28–36 px. |
| Conversion readiness | **6 / 10** | Transparent prices and no sign-up are real strengths. Undercut by the first calculator screen being invisible until JavaScript runs, a nav CTA that competes with the main funnel, value not shown at the choice, Accept below the fold, and no social proof yet (testimonials pending). |

**Overall: 6.5 / 10, with a short path to 8.** The top five changes below are mostly a week of
focused work and none touch pricing logic.

---

## Five highest-priority recommendations

1. **Render the first calculator screen visible in the server HTML** (P0, S). Fix the
   `initial={{ opacity: 0, x: 20 }}` on first mount so the first question paints before hydration.
2. **Rebuild the review step around the decision** (P1, M). Desktop: two columns with a sticky
   decision panel (total, Accept, Send proposal, "No payment needed yet"). Phone: Accept in the
   sticky bar.
3. **Give the shared foundation real weight on the package step** (P1, M). One "Every package
   includes" band with the five core services and payroll, so each card shows only its rhythm
   and extras. This re-proposes the strip Zjak removed in #147, so it needs his decision.
4. **Restore one accent and one primary per view** (P1, S–M). Nav CTA to a quiet outline; cyan
   taglines, labels and recap heading to neutral; red only for real errors.
5. **Size controls for a conversion surface** (P1, S). Buttons 44 px (primary 48 px), inputs
   44 px, edit chips and steppers with 44 px hit areas, applied through the `button` and `input`
   variants rather than per call site.

The full top ten, with effort, is [below](#top-10-improvements).

---

## Detailed findings

Priorities: **P0** critical · **P1** high impact · **P2** refinement · **P3** optional.
Effort: **S** under half a day · **M** one to two days · **L** more than two days.
"Objective" = a usability, accessibility or rule breach; "Judgement" = an aesthetic call.

### A. Global: navigation, CTA hierarchy, colour, type

**A1. Two competing primary actions in every first screen** — P1 · Objective (brand rule) · S
- *What:* the header's "Book a fit call" is a filled cyan button (28 px tall) and sits beside the
  page's gradient "Build your subscription" on the homepage hero, every service page hero
  (`d19`), the final CTA (`d06`) and the whole calculator (`d07`). The brand rule allows one
  gradient button per screen-height with "everything else nearby the outline button or a link";
  the nav button is neither.
- *Why it matters:* the calculator is the acquisition channel, yet the persistent, top-right,
  highest-contrast element sends people to `/contact`, which is a nine-field qualifying form
  (`m11`) before any calendar appears. That is the higher-friction path dressed as the main one.
- *Change:* make the header CTA the quiet outline button (or a plain link) everywhere; on
  `/pricing` consider hiding it, since the page already has "Not ready to commit? Book a fit call"
  at the bottom. If the nav must carry one primary, make it "Get your price" → `/pricing`.
  Source: `src/components/layout/Navbar.tsx:69` (desktop, `size="sm"`), `:111` (mobile menu).
- *Outcome:* one obvious next step per screen; the fit call stays available but reads as the
  alternative it is.

**A2. Cyan has become decoration** — P1 · Objective (brand rule "one accent colour per view") · S–M
- *What:* in one desktop viewport of "Three disciplines" (`d03`) cyan marks three icons, three
  taglines ("Compliance, covered."), twelve ticks and the CTA. On the
  package step: the "Tailored to your business" heading, edit pencils, three icon tiles, seventeen
  ticks, the Recommended badge, Pro's glow and the Continue button. On review: "Your subscription"
  label, "Pro package" pill, ten ticks and Accept.
- *Why:* the brand rule says cyan means "act here" or "look here", never decoration. When it is
  everywhere, the eye has nowhere to land, and the one cyan button stops being special.
- *Change:* keep cyan for (1) the primary button, (2) focus rings, (3) selection state, (4) key
  numbers if you like. Move taglines (`ServicePillars.tsx:43`), the recap heading
  (`AnswerRecap.tsx:53`), "Your subscription" and "Done by day 30" labels to `foreground` or
  `muted-foreground` at medium weight. Ticks: neutral (`foreground/70`) on marketing cards, cyan
  only where the tick means "this is what you are buying" (review step).
- *Outcome:* the page calms down and the CTA visibly brightens without changing it.

**A3. Red used as decoration on the problem cards** — P2 · Objective (brand rule) · S
- *What:* each problem card has a red icon tile and a red "The problem" label
  (`ProblemCards.tsx:118–122`, `d02`). The palette page says success/warning/danger are "states
  only, never decoration". Four red labels in a row also make the section read as an error state
  and, at desktop, repeat the same two words four times.
- *Change:* neutral icon tile and drop the label; the headline ("You never hear from your
  accountant") already says it is a problem. If a marker is wanted, use a muted label.
- *Note:* the round-2 feedback of 12 Oct added "a red problem border" and the next PR made cards
  "neutral at rest"; the red label survived. Worth a deliberate yes or no.

**A4. Heading scale is inverted and drifts** — P1 · Objective · S
- *What:* measured on the homepage at 1280 px: section `h2` = 36 px; `h3` = 16 px (problem
  cards), 20 px (services), 28 px (How it works), **40 px** (90-day cards: "Handing over" is
  larger than the section heading "Your first 90 days" above it, `d04`). "Meet the founder" is
  30 px. Page titles mix `font-bold` (privacy, terms, proposal, service heroes, error pages) and
  `font-semibold` (home, pricing).
- *Why:* hierarchy is how premium layouts feel calm. An h3 bigger than its h2 makes the 90-day
  section look like four separate pages.
- *Change:* define a five-step scale as tokens or utility classes in `globals.css` (for example
  display 64 / h1 40 / h2 32–36 / h3 22 / h4 17) and one weight for titles (semibold). Map every
  heading to it; 90-day card titles to h3 (22–24 px).
- *Effort:* S for tokens, then a sweep.

**A5. Every section uses the same composition** — P2 · Judgement · M
- *What:* problem cards, How it works, services, 90 days and the final CTA all open with a
  centred heading and a two-line muted intro, then glass cards with a 40 px icon tile. Section
  boundaries are the same faint hairline. The rhythm is consistent but monotonous; over 8,700 px
  on desktop (12,600 px on a phone) nothing changes register.
- *Change (strongest option):* vary **composition**, not decoration. Two or three sections with a
  left-aligned heading in a 5/7 split (heading and intro left, content right), for example
  services and the 90 days; keep centred for the hero and final CTA. Drop the icon tile where the
  heading already carries meaning (90-day cards, problem cards). One section on a slightly lighter
  surface (the founder) to give the page a "room" change. No new colours or effects.
- *Outcome:* the page reads as edited, not generated.

**A6. No current-page state and no Services entry in the nav** — P2 · Objective · S
- *What:* the header has Home, Pricing, Contact; none has `aria-current` or an active style
  (`Navbar.tsx`). The three service pages are reachable only from homepage cards and the footer.
- *Change:* add `aria-current="page"` plus a foreground colour for the active link; add a
  "Services" link (or the three services in a small menu) so `/accounting`, `/bookkeeping` and
  `/payroll` are one click from anywhere.

**A7. Text arrows beside icon arrows** — P3 · Objective · S
- "Continue →", "← Back", "Review →", "Book a fit call →" use the text glyph
  (`QuestionStep.tsx:58`, `:155`, `Step2Tiers.tsx`), while "Build your subscription" and "We can
  fix this" use Lucide `ArrowRight`. Use the icon everywhere (it aligns optically; the glyph sits
  low in Geist).

### B. Homepage

**B1. The hero is strong; keep it** — retain. The chaos → order → decision story card is the most
distinctive visual asset on the site and it is honest (labelled "Example figures"). On phone the
headline, copy and both buttons fit the first screen (`m01`). One nit: the trust line wraps to
leave "any month" alone on phone; use `text-wrap: balance` or shorten to "Fixed fee · No lock-in ·
Start any month".

**B2. Problem cards: four equal cards for four unequal problems** — P2 · Judgement · S
- The flip interaction ("We can fix this" → solution) is clever but makes the answer a click
  away; most visitors will not click four times. Consider showing problem and fix together on
  desktop (problem headline, one line, then the fix headline in foreground) and keeping the stack
  on phones. At minimum, remove the red (A3).

**B3. The 90-day section is very long for its job** — P2 · Judgement · M
- 3,600 px on desktop and 3,370 px on phone, larger than any other section, for content that
  matters *after* the decision. It is valuable reassurance but it currently outweighs the
  services and the founder.
- *Change:* tighten the cards (title 22–24 px, A4), and consider ending the section with the
  "What we'll need" checklist only as a link to the printable page.

**B4. The founder section is the best thing on the page** — retain, and promote. It is the only
place a real person, a real story and a credential (AGA(SA)) meet. Consider moving it above the
90 days, directly after services, so trust arrives before the commitment content. (Testimonials
remain the missing proof; the slot is already reserved.)

**B5. Partner logo strip** — P3 · Judgement. The marquee of Dext, SimplePay, Xero, SAICA etc. is
fine, but SAICA appears as a logo here and as "SAICA Member" text in the footer; make sure the
logo use matches the membership wording you can evidence.

### C. Calculator: opening and questions

**C1. The first question is invisible until JavaScript runs** — **P0** · Objective · S
- *What:* the server HTML for `/pricing` contains the first question and its Yes/No cards inside
  `style="opacity:0;transform:translateX(20px)"`. They only appear after hydration and the
  motion animation (`PricingCalculator.tsx:322–333`, `initial={{ opacity: 0, x: 20 }}` on every
  step including the first).
- *Why:* `docs/design-system.md` says above-the-fold copy is final in the server HTML, with no
  `opacity: 0` starting frame, because a measured case put the hero headline 1.9 s late on a
  phone. The same applies to the most important screen in the funnel. If JavaScript fails or is
  slow, `/pricing` shows a heading, a progress bar and an empty panel. Load time on a real phone
  was **not measured** here.
- *Change:* `<AnimatePresence initial={false}>` (or `initial={hasMoved ? … : false}`) so the first
  screen renders final and only later steps animate.

**C2. "A few quick questions" is eight or nine steps, and the count is hidden** — P1 · Objective · S
- *What:* the intro under the page title reads "A few quick questions, then your price." The
  screen-reader status reads "Step 3 of 8", then "Step 6 of 9" once payroll is chosen. Sighted
  users see only a thin bar, and its total changes when a branch adds a step (8 → 9), so its
  pace changes mid-flow. The same intro still says
  "a few quick questions" on the review step.
- *Change:* keep the bar (no numbered steps was decided on 6 Oct) but (1) change the intro to
  something true and short, such as "Six questions, then your price." if that holds for the
  longest path, or drop the count; (2) let the intro disappear after the first answer, which also
  gives back ~60 px on phones; (3) check that the bar never moves backwards when a branch adds a step (not tested here).

**C3. Unselected "Yes" shows a tick** — P2 · Objective · S
- *What:* on every Yes/No question the unselected "Yes" card carries a check icon in a grey tile
  and "No" a minus (`d08`). A tick is the universal "selected" mark; at rest it reads as a
  pre-answer.
- *Change:* show the icon only when selected, or use a neutral radio dot that fills on selection.

**C4. Long dropdowns for counted answers** — P2 · Judgement · M (challenges a decision)
- *What:* counted from the brackets embedded in the `/pricing` server HTML: revenue has 26
  options (Dormant plus 25 bands up to "350 Mil+"), transactions 60 (none, then "Up to 50" in
  steps of 25 to "Up to 1500") and employees **100** (one per person). All three are dropdowns.
- *Why:* long lists of near-identical numbers are slow to scan on a phone; the visitor knows a
  number, not a band, so they hunt for it.
- *Change:* employees and transactions as a number field with − / + steppers (44 px targets),
  mapped to the existing bracket in code, so no price logic changes. Revenue can stay a dropdown
  (26 named bands are a genuine choice list), perhaps with the most common five as quick picks
  above it. Dropdowns were kept by decision; this reopens that decision for the two counted
  answers.

**C5. The question column feels empty on desktop** — P3 · Judgement · S
- At 1280 px the question sits in a 672 px column with ~200 px of dark space before a hairline,
  a trust bar and "Not ready to commit?" (`d07`). Pull the trust bar up directly under the
  question card (one line, quieter) and drop the second hairline so the screen reads as one unit.

### D. Package selection and comparison (the critical step)

**D1. The shared foundation is undersold** — **P1** · Conversion · M (challenges #147)
- *What:* each card starts with one tick, "Core services included", then lists what differs
  (`d11`, `m04`). The five core services (finance team, year-round support, annual financial
  statements, SARS & CIPC submission, Xero) appear only inside the comparison table's collapsible
  "Core services" group below the fold, in the tooltip on the "Core services included" line
  (`src/config/tiers.ts:34`), and expanded for the first time on the review step after the choice
  (`d16`). "Payroll processing" is the last line on all three cards, identically.
- *Why:* this is the step that should make R 3 025 feel like good value. Today Basic looks like
  four ticks and a lot of empty space (its card is padded to Premium's height by the subgrid,
  `d11`), which signals "least" rather than "complete". The firm's philosophy, "more for better",
  needs the foundation to be visible, not abbreviated.
- *Change (recommended):* one quiet **"Every package includes"** band directly above the cards:
  the five core services plus "Payroll for 3 employees" (when chosen) as icon + short label, in a
  single row on desktop and a two-column list on phones, neutral ticks, no box-in-box. Each card
  then lists only its rhythm and extras. Careful with wording: Pro does not include Basic's lines
  as written, it upgrades them (weekly instead of monthly processing, a monthly instead of
  quarterly report), so "Everything in Basic, plus" would over-claim. Keep the rhythm and report
  lines on every card and list extras under them; any shared header wording needs Zjak's sign-off
  because it echoes the signed schedule. Equalise card heights by aligning the price row and the
  button, not by stretching Basic's list area.
- *Trade-off, stated plainly:* this re-proposes the slim strip shipped in #133 (~56 px) that Zjak
  removed in #147 on 13 Oct, when the comparison table's "Core services" group took over and a
  shared-services section was deferred "until proposals show 'what's included?' questions". What
  is different now: the package cards have since moved to the service-card style with the core
  reduced to one line (#147–#149), so the foundation is less visible on the cards than when the
  strip was removed, and the table that carries it is below the fold on desktop and three screens
  down on a phone (D6). If proposal questions are still the trigger Zjak wants, the cheaper test
  is to expand the "Core services included" line on the card itself into its five items.

**D2. Package cards are buttons containing lists** — P1 · Objective (accessibility) · M
- *What:* each card is one `<button>` with `aria-label="Pro package, recommended"` and
  `aria-describedby` pointing at the price (`Step2Tiers.tsx:216–237`). Inside are `div`, `ul` and
  `li` elements. Interactive content rules allow only phrasing content in a button, and the
  `aria-label` replaces the accessible name, so a screen-reader user hears the package name and
  price but **none of the inclusions** that differentiate the packages.
- *Change:* make the card a non-interactive `article` (or `li` in a list of packages) with a real
  `<button>` "Choose Pro" (with `aria-pressed`) at the bottom, and keep the whole card clickable
  with a stretched-link pattern (the button's `::after` covering the card). Inclusions become
  normal list content.
- *Outcome:* valid HTML, inclusions announced, and a clearer single target for keyboard users.

**D3. Selection is navigation, so the selected state is rarely seen** — P2 · Judgement · S
- *What:* choosing a package auto-advances to add-ons (#162). The "Selected" state, the
  "Continue to add-ons" button (disabled and dim until then) and Pro's "drop the glow when
  another is chosen" rule mostly matter only after Back.
- *Change:* keep auto-advance (it is faster), but remove the disabled "Continue to add-ons" button
  from the first visit (show it only when a package is already selected). A disabled cyan block
  on screen reads as "something is wrong".

**D4. Recommended treatment** — retain, with one tweak. Badge on the top edge plus a lit border is
the right amount; it does not overpower Basic or Premium (`d10`, `t01`). The hover state of any
package card lights the same cyan top edge (`globals.css:1809–1815`), so pointing at Basic makes two cards look
featured. Use a neutral (white 20 %) edge for hover and reserve cyan for featured and selected.
The edge animates `left` and `right` (`globals.css:1787`), which the motion rule forbids
("transform and opacity only"); use `transform: scaleX()`.

**D5. The answer recap is useful but awkward** — P2 · Objective · S
- *What:* "Tailored to your business" (cyan, A2) then chips separated by a literal "|" inside each
  list item (`AnswerRecap.tsx:68–72`). When the row wraps on phones and tablets the separator
  dangles at line ends (`m03`). Edit pencils are 12 px at 50 % opacity and chips are 28 px tall.
- *Change:* separate with `gap` and a middle dot drawn by CSS on `li + li::before`, or as quiet
  outlined chips. Pencil at full opacity in muted colour, chip hit area 44 px tall on touch.
  Heading in muted foreground.

**D6. The comparison table on phones is not a comparison** — P2 · Objective · M
- *What:* at 390 px "See all packages side by side" renders as three stacked per-package lists
  (`m05`), repeating the cards immediately above. Open by default, it adds roughly three screens.
- *Change:* on phones, keep the table as a real three-column grid with short cell values (tick,
  dash, "Weekly") and the row label above each row, or collapse it by default on phones only.
  Desktop table is good (`d12`): keep.

**D7. Phone layout: three tall cards in a column** — P1 · Mobile · M
- *What:* at 390 × 740 the first price sits at the fold (`m03`); cards run 491, 522 and 615 px
  tall; Premium's price is roughly 1,780 px down. Pro, the recommended package, is second.
- *Change:* with D1 the cards lose the repeated core and payroll lines (about 60 px each). Then
  either (a) a compact phone card (name, one line, price, three key differences, "Choose") with
  "What's included" collapsed, or (b) a horizontal snap carousel that opens on Pro with the
  neighbours peeking. (a) is the safer, more accessible option; recommended.

### E. Add-ons

**E1. Add-on cards work; the total lacks context** — P2 · S
- Whole-card toggle, `aria-pressed`, an inline quantity stepper for personal tax (`d13`) and a
  live total are all good. The selected state (cyan border, glow, filled tick) is heavier than the
  Recommended package; tone it to border + tick, no glow (A2).
- "Your monthly total R 4 975" (`d14`) does not say what it is made of. Add one muted line:
  "Pro R 3 775 + add-ons R 1 200".
- Names are Title Case ("WhatsApp Support", "Category Tracking", "Personal Tax Returns") under a
  sentence-case rule; use "WhatsApp support", "Category tracking", "Personal tax returns".
- The stepper buttons and the add/remove toggles should be 44 px on touch.

### F. Review and decision

**F1. The decision is below the fold on every device** — **P1** · Conversion · M
- *What:* review is one 672 px column: subscription card, a ten-line "What your Pro subscription
  includes" list, then the two action cards. At 1280 × 800 Accept is well below the first screen and
  appears only after scrolling past the inclusions list (`d15`, `d16`); at 390 × 740 it is at y ≈ 1,105 (`m07`, `m08`). On the phone the sticky bar on
  this step shows "Pro package · monthly total R 3 775" with **no button** (it only has an action
  on add-ons, `PricingCalculator.tsx:373`), so it repeats the total already on screen and takes
  70 px from the content.
- *Change (recommended):* desktop: two columns inside the existing 1090 px container. Left: the
  line items and what's included. Right, sticky: total, "Accept and sign" (primary), "Email me the
  proposal" (outline), "No payment needed yet · cancel with 30 days' notice". Phone: the sticky
  bar carries "Accept" on the review step (the bar exists already), and the inclusions list is
  collapsed to "10 services included · Show" under the summary.
- *Outcome:* the total, the reassurance and the action are visible together at the moment of
  decision. Expect this to be the single biggest conversion lift in the review.

**F2. Reassurance copy is in the wrong place and mislabelled** — P2 · S
- "No payment needed yet" is a small centred line under the action cards, followed by a paragraph
  about band changes and catch-up that has nothing to do with payment. "Catch-up for the 3
  months before you accept is included" is a selling point set as small print (already parked as
  #16 on 13 Oct). Put "No payment needed yet" inside the decision panel, make catch-up a tick in
  the inclusions, and keep the band-change sentence as a footnote.

**F3. "Accept" is vague** — P3 · S. The button opens a details form, not an acceptance. "Accept
and sign" is already the modal's submit label; use "Continue to sign" or "Accept and sign" on the
review button too, and "Email me the proposal" instead of "Send proposal" (who sends to whom?).

### G. Proposal modal, proposal page and signing

**G1. The Accept modal is in good shape** — retain. Compact summary row instead of the full card
(the 13 Oct fix landed), labels correctly associated, `aria-invalid` + `aria-describedby` on errors,
errors on blur not on open, no autofocus on phones (focus lands on the summary), 16 px inputs so
iOS does not zoom, and it nearly fits a 740 px phone screen (31 px of internal scroll) (`d17`, `d18`, `m09`). Two refinements:
inputs are 32 px tall (raise to 44 px, see I1), and the consent checkbox is 16 px (enlarge the
hit area to the whole label row; it already toggles from the label).

**G2. The proposal document is set small and grey** — P2 · from code, **not seen rendered** · M
- *What:* in `ProposalSections.tsx` (lines 99–195) the list bodies (inclusions, not included,
  We'll / You'll) are `text-sm` (14 px) in `muted-foreground`; section labels, allowance details,
  the terms notes and footnotes are `text-xs` (12 px). This is the document the client signs and
  that becomes the debit-order mandate.
- *Why:* 14 px muted body with 12 px labels on dark makes the legal parts read like small print,
  which works against "transparency".
- *Change:* body 15–16 px in foreground, labels 13–14 px semibold, muted only for footnotes.
  Consider the light "document" palette (already defined for PDFs and email) for the proposal
  body so screen and PDF look like the same document.
- *Verify:* render a real proposal (test token) at 390 and 1280 px before deciding.

**G3. The "Proposal not found" state is clear** — retain (`m10`). One improvement: add the email
address or "Book a fit call" as a second option for someone whose link has expired.

### H. Contact

**H1. "Book a fit call" requires a nine-field form first** — P1 · Conversion · M (challenges a
decision of 12 Oct)
- *What:* every "Book a fit call" goes to `/contact`; the calendar link appears only after first
  name, last name, business, email, revenue, team size, current bookkeeper, services and consent
  (`m11`).
- *Why:* qualification protects Zjak's time (valid under the hours budget), but the fit call is
  sold as the low-commitment alternative. Nine required fields is the opposite.
- *Change:* if qualification must stay, cut to name, email, business and revenue (four), show the
  calendar immediately after, and ask the rest on the booking form. Remove the label-echo
  placeholders ("First name" / "Your first name") and "Simply" from the intro.

### I. Shared components, states and accessibility

**I1. Controls use dashboard density** — **P1** · Objective (touch) / Judgement (premium) · S
- *What:* `button.tsx` default is `h-9` (36 px), `sm` 28 px; `input.tsx` is `h-8` (32 px). On the
  calculator the Back and Continue buttons are 36 px on phones, answer chips 28 px, tooltip
  triggers 24 px, the table's "Core services" toggle 16 px tall. WCAG 2.5.8 (AA) needs 24 px or
  spacing; Apple and Google guidance is 44–48 px.
- *Why:* small controls are the fastest way to look like a template; generous controls read as
  confident.
- *Change:* add a marketing size scale to the variants rather than editing call sites: `default`
  44 px, `lg` 48 px for primary actions, inputs 44 px, and use the larger size across `(site)` and
  `/proposal`. Keep 36 px only in the internal tool.

**I2. Focus and keyboard** — good. Global 3 px `:focus-visible` ring that clears 3:1, roving
`tabindex` on the Yes/No radiogroups, focus moved to each step heading with a live region, Escape
closes dialogs. Retain.

**I3. Reduced motion** — P3 · Objective · S. Under `prefers-reduced-motion` the CSS *increases*
the hover jump (`translateY(-10px) scale(1.025)`, `globals.css:1669–1677`). It is instant, so it
is not animation, but a larger jump is the opposite of what these users asked for; use the same
or smaller offset with no scale.

**I4. Disabled primary buttons look like dull primaries** — P2 · S. "Continue" at 50 % opacity
cyan (`d07`) reads as a broken button. Disabled primaries should be a neutral fill with muted
text, or hidden until actionable (D3).

**I5. Dev-only noise** — not a defect. The "1 issue" badge in screenshots is Next's dev overlay
for an `eval()`/CSP message that does not occur in production. The console also warns that the
navbar logo has width or height changed but not both; fix with `height: auto`.

### J. Responsive summary

| Width | Verdict | Main issues |
|---|---|---|
| Desktop 1280 | Good composition, under-used width in the calculator | A1, A2, A4, D1, F1 (review in one narrow column) |
| Tablet 768 | Works; three 219 px package cards are tight but legible, prices fit (`t01`) | D5 dangling separators; cards wrap descriptions to five lines |
| Phone 390 | Calm, no overflow, good bottom bar on add-ons | C2, C4, D6, D7, F1 (bar without action), I1 |

No horizontal scroll was found at any width checked (scroll width = viewport width at 390).

---

## Top 10 improvements

| # | Change | Problem today | Recommended solution | Expected impact | Effort |
|---|---|---|---|---|---|
| 1 | First calculator screen visible on first paint (C1) | Question ships at opacity 0 until hydration | `AnimatePresence initial={false}` for the first step | Funnel works before JS; meets your own first-paint rule | S |
| 2 | Review step built around the decision (F1, F2) | Accept below the first screen on every device; phone bar with no action | Two columns + sticky decision panel on desktop; Accept in the phone bar; inclusions collapsed on phones | Largest likely conversion lift | M |
| 3 | "Every package includes" band + cards showing only rhythm and extras (D1, D7) | Core value hidden in one tick; Basic looks empty | One slim band above cards; cards list differences only | Basic feels complete, upgrades read clearly, phone cards shorter | M |
| 4 | One accent, one primary per view (A1, A2, A3) | Cyan and red used as decoration; nav CTA competes | Nav CTA to outline; taglines, labels, ticks neutral; no red labels | Calmer, more expensive look; CTA stands out | S–M |
| 5 | Conversion-sized controls (I1) | 36 px buttons, 32 px inputs, 28 px chips | Variant sizes 44/48 px across site and proposal | Better touch use; more confident feel | S |
| 6 | Package cards as articles with a real button (D2) | Inclusions not announced; invalid HTML | `article` + stretched "Choose" button | Accessible comparison | M |
| 7 | Heading scale and weights (A4) | h3 bigger than h2; bold vs semibold | Five-step type tokens; one title weight | Clear hierarchy everywhere | S |
| 8 | Honest progress and shorter header (C2) | "A few quick questions" for 8–9 steps; bar pace changes | True intro, hide after step 1, bar never moves back | Less abandonment mid-flow; more space on phone | S |
| 9 | Steppers for counted answers (C4) | 100-option employee and 60-option transaction dropdowns | Number steppers mapped to existing brackets | Faster, less fiddly questions | M |
| 10 | Readable proposal document (G2) | Signed document in 14 px muted body, 12 px labels | 15–16 px body, light document surface | Trust at signature; matches the PDF | M |

---

## Design direction

**The idea: a quiet ledger, not a light show.** Capucor sells order and clarity. The interface
should behave like a well-kept set of books: generous margins, clear columns, one mark of colour
where something needs attention. Premium comes from confidence in space and type, not from glow.

**Keep (already strong):**
- Deep-navy background and surface tokens; Geist and Geist Mono; tabular "R 3 775" prices with
  no-break spaces and `/month` on the baseline.
- The hero story card, the founder section, the plain SA-specific voice.
- The focus system, live-region step announcements, validation pattern and the modal.
- Subgrid alignment on peer cards; the Recommended badge on Pro; the add-on whole-card toggle;
  the phone bottom bar.
- One easing curve and restraint in motion (no scroll-lit text, no phone blur).

**Change:**
- **Typography:** a defined scale (display / h1 / h2 / h3 / body / small), semibold titles, body
  at 16–17 px on marketing pages, 15–16 px minimum in the proposal. Let a few headings sit left
  in a split layout (A5).
- **Colour discipline:** cyan only for primary action, focus, selection and the occasional key
  number. Neutral ticks and taglines. Red and amber only for real states.
- **Spacing:** keep `py-14 lg:py-20` but vary composition; more space between a heading and its
  content than between items inside a card.
- **Surfaces:** fewer glows. Keep the glass card for service and package peers, but drop the
  coloured hover glow from cards that are not choices, and use the outline (not glow) as the
  hover cue. One section on a slightly lighter surface for variety.
- **Borders and radii:** current 8–20 px scale is fine; standardise cards at 16 px (`xl`) and
  buttons at 12 px; avoid `rounded-[4px]`/`[2px]` one-offs outside the hero story.
- **Shadows:** one card shadow token; no coloured shadow except on the featured card.
- **Iconography:** Lucide at one stroke weight; icon tiles only where the icon adds meaning
  (services, packages), not on every card title; icon arrows, never text arrows.
- **Interaction:** hover = neutral edge + 2–3 px lift; selection = cyan edge + tick; disabled =
  neutral; press = short scale-down on touch (already in place).

---

## Implementation roadmap

**Quick wins (one PR each, under a day):**
1. C1 first-paint fix.
2. A1 nav CTA to outline.
3. A2/A3 colour sweep (taglines, labels, recap heading, red labels, add-on glow).
4. A4 heading tokens and the 90-day h3 fix.
5. I1 button and input size variants.
6. C3 tick on unselected Yes, A7 icon arrows, E1 sentence-case add-on names, D5 recap separators,
   I4 disabled style, logo `height: auto`.

**Foundations (before the larger changes, so they inherit them):**
7. Type scale, control sizes and the colour rule written into `docs/design-system.md` and the
   brand page, so later work follows them.

**Substantial (one to two days each, in this order):**
8. F1/F2 review step with the decision panel and phone bar action.
9. D1/D2/D7 package step: foundation band, articles with a real button, compact phone cards,
   D6 phone table.
10. C2/C4 progress copy, employee and transaction steppers.
11. G2 proposal document type and surface (render a test proposal first).
12. H1 shorter fit-call form (needs Zjak's decision on qualification).
13. A5/B2/B3/B4 homepage composition pass (left-aligned splits, problem + fix together, shorter
    90 days, founder earlier).

Every step stays inside existing components and tokens; none touches `pricing.ts`,
`proposalPricing.ts`, `tiers.ts` figures or package rules.

---

## Decisions this review challenges

Listed so they are reopened deliberately, not by accident:

| Decision | Date / PR | This review recommends | Finding |
|---|---|---|---|
| "Included in every package" strip removed; core services live in the table | 2026-10-13, #147 | A slim band returns, cards list differences only | D1 |
| Every "Book a fit call" goes through the qualifying form first | 2026-10-12/13, #126–#128 | Four fields, calendar straight after | H1 |
| Dropdowns kept (parked #18 was about the transactions list) | 2026-10-13 | Steppers for employees and transactions; revenue stays a dropdown | C4 |
| No numbered steps on the progress bar | 2026-10-06 | Keep the bar; fix the intro copy and backward jumps | C2 |

---

## Evidence index

| File | What it shows |
|---|---|
| `d01-home-hero` | Hero at 1440 (nav cyan button + gradient CTA) |
| `d02-home-problems` | Problem cards with red labels |
| `d03-home-services` | Services: cyan icons, taglines, ticks |
| `d04-home-90-days` | "Handing over" h3 (40 px) under h2 (36 px) |
| `d05-home-founder` | Founder section |
| `d06-home-final-cta-footer` | Final CTA beside the nav CTA; footer |
| `d07-calc-first-question` | First question, disabled Continue, empty column |
| `d08-calc-yes-no-zoom` | Tick on unselected "Yes" |
| `d09-calc-revenue-dropdown` | Revenue dropdown |
| `d10-packages-top` | Package step top: recap, cards, Recommended |
| `d11-packages-lists` | Card lists; Basic's empty space; identical first and last ticks |
| `d12-packages-comparison` | Desktop comparison table |
| `d13-addons-quantity` | Selected add-ons, quantity stepper |
| `d14-addons-total` | Add-on total without breakdown |
| `d15-review-top` / `d16-review-actions` | Review: summary, inclusions, actions below |
| `d17-accept-modal` / `d18-accept-modal-validation` | Accept modal, inline errors |
| `d19-accounting-hero` | Service page hero |
| `m01-home-hero` | Phone hero |
| `m02-calc-first-question` | Phone first question |
| `m03-packages-first-screen` | Phone package step first screen; dangling separators |
| `m04-packages-basic-card` | Phone Basic card |
| `m05-packages-comparison` | Phone "side by side" as stacked lists |
| `m06-addons` | Phone add-ons with sticky bar |
| `m07-review-top` / `m08-review-actions` | Phone review; bar without action |
| `m09-accept-modal` | Phone Accept modal |
| `m10-proposal-not-found` | Invalid proposal link |
| `m11-contact` | Phone contact form |
| `t01-packages-tablet` | Tablet package cards |

Desktop captures came from a pane scaled to fit, so they are smaller than 1280 px; measurements
in the text were read from the DOM, not from the images. The separate untracked folder
`docs/design-review-evidence/` holds the 39 screenshots of a parallel Codex audit run the same
morning; its report was overwritten by this file at the same path. Its distilled findings are
kept in the owner's workspace and are re-checked in the follow-up work.
