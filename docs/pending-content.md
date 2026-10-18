# Pending content — client testimonials and social proof

> A reserved homepage slot, what was removed from it, and what must not go back.
>
> Extracted from `AGENTS.md` on 2026-09-03 (EH-02); the words are unchanged.
>
> Canonical agent instructions: [`../AGENTS.md`](../AGENTS.md).

---

## Pending Content: Client Testimonials / Social Proof

The slot reserved for **real client testimonials / social proof** sits between the **What we do** (`ServicePillars`) and **Your first 90 days** (`FirstNinetyDays`) sections (the packages teaser left the homepage on 2026-10-10). Its previous occupant — the "A Month with Capucor" four-week timeline (`OutcomeStories.tsx`) — was removed.

- Placement: `src/app/(site)/page.tsx`, between `ServicePillars` and `FirstNinetyDays` (look for the placeholder HTML comment). The homepage FAQ was retired and its `FaqAccordion` + `config/faq.ts` removed; rebuild fresh if a FAQ section is wanted later.
- Blocker: testimonials still need to be collected from clients. Once 3–5 quotes (name, role, company, quote, ideally a headshot) are in hand, build a new `Testimonials.tsx` landing component and slot it in.
- Do not ship the old four-week timeline visual back — it was scrapped intentionally. Build fresh around the real quotes.

## Meet the founder: complete (2026-10-18)

`FounderTeam.tsx` (homepage, between **Your first 90 days** and the final CTA) is the one place the
site names the founder (owner decision 2026-10-18; see `voice-and-copy.md`). Its copy and photo
(`public/team/founder.jpg`, `founder-avatar.jpg`) were confirmed by the owner line by line;
change none of it without him. Nothing is pending.
