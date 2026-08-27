# Capucor — Voice & Copy Guide

> **This guide is the website-specific extension of the cross-product Capucor Brand Voice &
> Content Standard**, which lives at `capucor-docs/rules/brand-voice-and-content.md` in the
> private `capucor-docs` repository. (Named in prose, not linked: the two repositories are
> separate and a relative link from here would not resolve.)
>
> **The cross-product standard governs shared brand rules — voice, tone, banned vocabulary and
> sentence structure. This guide governs implementation details that apply only to capucor.com**
> — the JSX apostrophe rule, landing-page patterns, and the reference examples below. Where the
> two conflict on a shared brand rule, the cross-product standard wins, and this file should be
> corrected rather than treated as an exception.
>
> Section numbers referenced below (§6 discouraged language, §7 sentence structure, §10
> relationship to marketing guidance) are sections of that standard.

The full guide for writing and reviewing all user-visible website copy. [`AGENTS.md`](../AGENTS.md)
carries the condensed essentials; this is the complete website reference. Before writing or
reviewing any copy, check every sentence against these rules — if a rewrite introduces any banned
pattern, fix it before shipping.

All copy must be conversational, direct, and grounded in specific South African business context.
The goal is copy that sounds like a knowledgeable person talking to a business owner, not a
marketing template. (A 2026 AI-writing audit flagged the patterns below as making the site sound
generic and untrustworthy.)

---

## Banned vocabulary

This list is reconciled with §6 of the cross-product standard and matches it item for item
(`"align with"` originated here and was promoted to the canonical list). If the two ever diverge
again, the canonical list governs and this one is the copy to correct.

Do not use these words or phrases anywhere in user-visible copy:

- "best-in-class"
- "purpose-built"
- "tech-forward"
- "cutting-edge"
- "seamless"
- "leverage"
- "robust"
- "scales with your business"
- "financial clarity"
- "delivers concrete results"
- "cleaner compliance" / "better financial control" (abstract outcome clusters)
- "nothing falls through the cracks"
- "covered end-to-end"
- "delve", "intricate", "tapestry", "pivotal", "underscore", "testament", "landscape", "bolstered", "align with", "meticulous"

---

## Banned structural patterns

### Em dash overuse (the main AI tell)
Never use em dashes as a connective shortcut at the end of a clause:
- ❌ "Your books are ready — and you'll never miss a deadline."
- ✅ "Your books are ready. You'll never miss a deadline."
- ❌ "Tax structuring, cash-flow timing, B-BBEE certificates — included."
- ✅ "Tax structuring, cash-flow timing, B-BBEE certificates: all included."

**Em dashes are banned outright in outbound emails, proposal documents, and PDF renders.**
There is no "one per section" allowance in those surfaces: rewrite the sentence (split on a
period, or use a colon to introduce a list) so no prose em dash survives. The only em dash that
may stay in a proposal/PDF is a non-prose data placeholder — an empty-value glyph (`'—'` for a
missing date) or the separator inside a fair-usage bracket label.

In marketing prose (the public site), one deliberate em dash per section is acceptable for rhythm
("no callback — just a number"); multiple em dashes in the same paragraph or section is not.

**The "one per section" figure is a website-specific concretisation of canonical §7, not an
exception to it.** §7 says marketing prose "may use an em dash very sparingly when the rhythm
genuinely benefits"; one per section is this site's working reading of "very sparingly". The
outright ban on em dashes in emails, proposals and PDF prose is §7's rule verbatim.

### Triple-always parallel structure
- ❌ "Your numbers are always current, your filings are always on time, and your accountant is always ahead."
- ✅ "By the time the new month starts, your books are closed, your returns are filed, and there's a management report in your inbox."

### Triple-negative kickers
Avoid ending paragraphs with "No X, no Y, no Z". Canonical §7 bans repeated "no X, no Y, no Z"
kickers with no carve-out, so there is no site-specific exception to reach for:
- ❌ "No forms, no waiting, no obligation."
- ✅ "No contact form, no callback — just a number." (two-item is acceptable)

### Negative parallelism
Avoid "not X, but Y" and "A system, not ad-hoc work" constructions:
- ❌ "Your subscription delivers concrete results — not ad-hoc work when you happen to call."
- ✅ "Every month, your books are clean, your filings are done, and your accountant has already flagged anything worth discussing."

### Double-negative marketing kickers
- ❌ "No hard sell, no obligation."
- ✅ "It's a conversation, not a sales pitch."

---

## Voice guidelines

- **Write to the owner, not about the business.** "You'll see" not "clients see". "Your books" not "businesses' books".
- **Use contractions.** "we'll", "you'll", "it's", "don't" — sounds human.
- **Name the concrete thing.** "your P&L" not "financial clarity". "your SARS submission" not "compliance outcomes".
- **Prefer periods over em dashes.** When tempted to join two clauses with an em dash, use a period instead.
- **Short sentences over long compound ones.** If a sentence needs an em dash or semicolon to hold together, split it.
- **South African specificity is a strength.** SARS, CIPC, EMP201, VAT201, POPIA, SAICA, UIF, PAYE, COIDA, IRP5, B-BBEE — use these. They signal genuine local expertise and should never be softened into generic equivalents.
- **Headings are sentence case.**

---

## JSX implementation rule — apostrophes in copy

Contractions are encouraged for a conversational voice, but raw apostrophes in JSX text content
trigger the `react/no-unescaped-entities` ESLint error and break CI.

**Rule:** Any contraction or possessive written directly inside a JSX element must use `&apos;`
instead of `'`.

- ❌ `<p>You'll see an exact price.</p>` — ESLint error
- ✅ `<p>You&apos;ll see an exact price.</p>` — correct

This applies to: `you'll`, `we'll`, `it's`, `don't`, `can't`, `you're`, `we're`, and any other
contraction or possessive in JSX text nodes. Apostrophes inside JS string literals (e.g. in a
`const` array of strings rendered via `{item.body}`) are fine as-is — the rule only applies to
literal JSX text content.

---

## What good copy looks like on this site

Reference examples of strong, human-sounding copy:

- "No more shoebox accounting at year-end."
- "We believe you should stay because the service is valuable, not because you're trapped."
- "SARS penalties don't care that you forgot."
- "Pull a clean P&L or balance sheet any time."
- "It's a conversation, not a sales pitch."
- "By the time the new month starts, your books are closed, your returns are filed, and there's a management report in your inbox."
