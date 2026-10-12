"use client";

import Link from "next/link";
import { ArrowRight, Calendar, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { siteConfig } from "@/config/site";
import { useCardDeck } from "@/hooks/useCardDeck";

// A new client's first 90 days, told once (90-day roadmap interview,
// 2026-10-12). How it works is every month; this is the road to the first
// normal quarter. Two tracks: the monthly rhythm starts in the first 30 days
// and catch-up runs alongside, never ahead of it. Catch-up rule (pricing
// figures decision, 2026-10-06): the 3 months before acceptance are included;
// older work is quoted. Each band says what is done by its end, never how long
// a step takes. No amounts, packages, response times or bank feeds, and never
// "your logins": the software is ours and we hand your records over if you
// leave.
//
// Wide cards that stack as you scroll (Zjak, 2026-10-12): each card sticks
// in the middle of the screen and the next one is dealt fully over it, while
// the one beneath eases back and dims, so only one card holds the eye. The second half of each card is a milestone checklist;
// photos or other visuals may replace it later.
const CARDS = [
  {
    label: "Days 1–30",
    title: "Set up",
    body: "You sign, and one email arrives with a short list of what we need. We set you up on Xero, and on SimplePay if you have staff, all included in your fee, and your monthly rhythm starts. Behind on your books? The 3 months before you signed are included. Anything older we quote upfront and run alongside, so it never holds up your month.",
    listTitle: "Done by day 30",
    items: [
      "Your details and access in hand",
      "Xero set up, and SimplePay if you have staff",
      "Payroll taken over on its next cycle",
      "Your monthly rhythm running",
      "Older catch-up quoted, if there is any",
    ],
  },
  {
    label: "Days 31–60",
    title: "Settle",
    body: "This is the month you stop chasing. Your books are processed, payroll and VAT go out on their cycles, and the months before you joined are brought up to date. We check your SARS profile, so you know what’s outstanding and the plan to clear it.",
    listTitle: "Done by day 60",
    items: [
      "Each month processed and reconciled",
      "Payroll and VAT submitted on their cycles",
      "The 3 included catch-up months up to date",
      "Your SARS position checked",
    ],
  },
  {
    label: "Days 61–90",
    title: "Review",
    body: "We sit down for your 90-day review: what we found, what we’ve fixed and what comes next. Tell us what’s working and what isn’t. You leave with a plan for the next quarter, and you stay because it works: month to month on 30 days’ notice. If you ever leave, we hand over your Xero file and SARS eFiling.",
    listTitle: "Done by day 90",
    items: [
      "Each month since you signed closed and reported",
      "Your 90-day review held",
      "Your feedback heard",
      "A plan for the next quarter",
    ],
  },
  {
    // Same list as the welcome checklist sent on signing.
    label: "From you",
    title: "What we’ll need",
    body: "One list, sent when you sign. The sooner it’s back, the sooner your rhythm starts.",
    listTitle: "Your checklist",
    items: [
      "CIPC registration details and SARS tax numbers",
      "UIF and COIDA references, if registered",
      "Xero access if you already use it, and SARS eFiling",
      "Opening balances: financial statements, trial balance, ledger, debtors, creditors and fixed asset register",
      "Your latest payroll run and employee details",
      "Your go-ahead to contact your previous accountant",
    ],
  },
];

export function FirstNinetyDays() {
  const deckRef = useCardDeck<HTMLDivElement>();

  return (
    <section id="first-90-days" className="premium-section py-14 lg:py-20">
      <SectionDivider />
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <SectionHeading
          title="Your first 90 days"
          subtitle="You sign, and we take it from there. Your monthly rhythm starts in the first month, and any backlog is cleared alongside it."
        />

        <div ref={deckRef} className="stack-deck mt-12">
          {CARDS.map((card, i) => (
            <article
              key={card.label}
              className="stack-card deck-card"
              data-flip={i % 2 === 1 ? "" : undefined}
              aria-label={`${card.label}: ${card.title}`}
            >
              <div className="deck-card-copy">
                <span className="deck-pill">{card.label}</span>
                <h3 className="deck-title">{card.title}</h3>
                <p className="deck-body">{card.body}</p>
              </div>
              <div className="deck-panel">
                <p className="deck-panel-title">{card.listTitle}</p>
                <ul className="deck-list">
                  {card.items.map((item) => (
                    <li key={item}>
                      <span className="deck-check" aria-hidden>
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 flex flex-col justify-center gap-3 sm:flex-row">
          <Button
            nativeButton={false}
            render={<Link href="/pricing" />}
            size="lg"
            className="gradient-cta gap-2 w-full sm:w-auto"
          >
            <span className="relative z-[2] inline-flex items-center gap-2">
              Build your subscription <ArrowRight className="h-4 w-4" />
            </span>
          </Button>
          <Button
            nativeButton={false}
            render={
              <a
                href={siteConfig.links.booking}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
            variant="outline"
            size="lg"
            className="gap-2 w-full sm:w-auto"
          >
            <Calendar className="h-4 w-4" /> Book a fit call
          </Button>
        </div>
      </div>
    </section>
  );
}
