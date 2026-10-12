"use client";

import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CalendarCheck,
  Check,
  ClipboardList,
  MessagesSquare,
  Printer,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { ONBOARDING_CHECKLIST } from "@/config/onboardingChecklist";
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
// the one beneath eases back and dims, so only one card holds the eye. The
// second half of each card is a milestone checklist; photos or other visuals
// may replace it later.
//
// Copy pass (Zjak, 2026-10-12): one lived moment per stage in a short, punchy
// body, and the owner's part told as it happens, not saved for the end. Each
// stage has a "Your part" line (two or three lines) that says plainly where
// the effort is high; an effort meter was tried and dropped. The leaving
// terms sit beside the ask, on the last card, which links to the printable
// checklist.
//
// Clean stack (Zjak, 2026-10-12): no glow or drop shadow round the cards, so
// nothing of the cards beneath shows round the one in view. The "Days 1–30"
// pills and the three-bar progress track are gone: each card opens with an
// icon beside its title, as on the cards in
// "Three disciplines. One subscription." (Zjak: no hook line under it).
type Card = {
  icon: LucideIcon;
  title: string;
  body: string;
  yours?: string;
  listTitle: string;
  items: string[];
  checklistLink?: boolean;
};

const CARDS: Card[] = [
  {
    icon: Settings2,
    title: "Set up",
    body: "You sign, and one email lands with a short list. Payday comes and your staff are paid as usual, now through SimplePay. Behind on your books? The 3 months before you signed are included. Anything older is quoted upfront and runs alongside.",
    yours: "This is the month that needs you most. Send the list back, approve our access to SARS and your software, and tell us what else is missing.",
    listTitle: "Done by day 30",
    items: [
      "Your details captured and verified",
      "Software setup done with access",
      "Payroll taken over and running",
      "Your first month closed",
      "Catch-up work quoted, if there is any",
    ],
  },
  {
    icon: CalendarCheck,
    title: "Settle",
    body: "This is the month you stop chasing. The 7th arrives and your EMP201 is already filed. Your books are reconciled, and anything outstanding at SARS has a name and a plan.",
    yours: "Much lighter. Answer the odd question about some transactions, and snap the slips we ask for. Most months, that’s a quick email reply from you.",
    listTitle: "Done by day 60",
    items: [
      "Each month processed and reconciled",
      "Payroll and VAT submitted on their cycles",
      "All your workflows created and scheduled",
      "Your SARS position known, with an action plan",
    ],
  },
  {
    icon: MessagesSquare,
    title: "Review",
    body: "Ninety days in, we sit down properly: what we found, what we fixed, what’s still open. Your first reports set the baseline, and your feedback shapes the next ones.",
    yours: "Commit some time for the review and bring your questions. Tell us honestly what’s working and what isn’t. That’s how the next quarter gets better.",
    listTitle: "Done by day 90",
    items: [
      "Each month closed correctly since you signed",
      "Your 90-day review is in the calendar",
      "Your feedback is heard and valued",
      "Now we start planning your next moves",
    ],
  },
  {
    // Same list as the welcome checklist sent on signing.
    icon: ClipboardList,
    title: "What we’ll need",
    body: "Most of this you already have somewhere. Start gathering now and your first month will be a breeze. Can’t find something? With your go-ahead, we’ll ask your previous accountant. You stay month-to-month on 30 days’ notice, and if you leave, we hand over your Xero and eFiling.",
    listTitle: "Your checklist",
    items: ONBOARDING_CHECKLIST.map((c) => c.item),
    checklistLink: true,
  },
];

export function FirstNinetyDays() {
  const deckRef = useCardDeck<HTMLDivElement>();

  return (
    <section id="first-90-days" className="premium-section py-14 lg:py-20">
      <SectionDivider />
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <ScrollReveal>
          <SectionHeading
            title="Your first 90 days"
            subtitle="The first month asks the most of you. After that, it settles into the monthly rhythm. Here’s what happens from the day you sign, and what we’ll need."
          />
        </ScrollReveal>

        <div ref={deckRef} className="stack-deck mt-12">
          {CARDS.map(({ icon: Icon, ...card }, i) => (
            <article
              key={card.title}
              className="stack-card deck-card"
              data-flip={i % 2 === 1 ? "" : undefined}
              aria-label={card.title}
            >
              <div className="deck-card-copy">
                <div className="deck-lockup">
                  <span aria-hidden className="svc-icon">
                    <Icon className="h-[22px] w-[22px]" />
                  </span>
                  <h3 className="deck-title">{card.title}</h3>
                </div>
                <p className="deck-body">{card.body}</p>
                {card.yours && (
                  <div className="deck-yours">
                    <p className="deck-yours-head">Your part</p>
                    <p className="deck-yours-text">{card.yours}</p>
                  </div>
                )}
              </div>
              <div className="deck-panel">
                {/* The panel can move below the copy once photos arrive. */}
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
                {card.checklistLink && (
                  <Link href="/resources/onboarding-checklist" className="deck-panel-link">
                    <Printer className="h-4 w-4" aria-hidden />
                    Print or save the checklist
                  </Link>
                )}
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
                href={siteConfig.links.fitCall}
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
