# Capucor — Voice & Copy Guide

The full guide for writing and reviewing all user-visible website copy. [`AGENTS.md`](../AGENTS.md)
carries the condensed essentials; this is the complete reference. Before writing or reviewing any
copy, check every sentence against these rules — if a rewrite introduces any banned pattern, fix
it before shipping.

All copy must be conversational, direct, and grounded in specific South African business context.
The goal is copy that sounds like a knowledgeable person talking to a business owner, not a
marketing template. (A 2026 AI-writing audit flagged the patterns below as making the site sound
generic and untrustworthy.)

---

## Banned vocabulary

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

One deliberate em dash per section is acceptable for rhythm ("no callback — just a number").
Multiple em dashes in the same paragraph or section is not.

### Triple-always parallel structure
- ❌ "Your numbers are always current, your filings are always on time, and your accountant is always ahead."
- ✅ "By the time the new month starts, your books are closed, your returns are filed, and there's a management report in your inbox."

### Triple-negative kickers
Avoid ending paragraphs with "No X, no Y, no Z":
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
- "Pull a clean P&L or balance sheet any time. No waiting, no chasing, no surprises."
- "It's a conversation, not a sales pitch."
- "By the time the new month starts, your books are closed, your returns are filed, and there's a management report in your inbox."
