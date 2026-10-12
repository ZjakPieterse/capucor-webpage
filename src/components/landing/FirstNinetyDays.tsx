"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Calendar, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { siteConfig } from "@/config/site";

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
// under the header and the next one is dealt over it, while the one beneath
// eases back and dims. The second half of each card is a milestone checklist;
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

/**
 * Deals the cards. Every card gets the tallest card's height, so a shorter card
 * never shows the one beneath. A card taller than the screen sticks by its
 * bottom edge instead (negative top), so it is read in full before the next one
 * covers it. While the next card slides over, `--deck-p` (0..1) eases the card
 * back and dims it: written to the DOM, not state, so scrolling never
 * re-renders, and only transform and opacity animate (no filter).
 */
function useCardDeck() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const deck = ref.current;
    if (!deck) return;
    const cards = [...deck.querySelectorAll<HTMLElement>(".deck-card")];
    if (!cards.length) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // The stack lives between the sticky header and, on phones, the floating
    // CTA bar. A screen too short for the tallest card gets a plain list.
    const layout = () => {
      delete deck.dataset.flat;
      cards.forEach((card) => {
        card.style.minHeight = "";
        card.style.top = "";
      });
      const tallest = Math.max(...cards.map((card) => card.offsetHeight));
      const header = document.querySelector("header")?.offsetHeight ?? 64;
      const bar = document.querySelector<HTMLElement>(".mobile-cta-bar");
      const barHeight = bar && getComputedStyle(bar).display !== "none" ? bar.offsetHeight : 0;
      const bottom = window.innerHeight - barHeight - 12;
      cards.forEach((card) => {
        card.style.minHeight = `${tallest}px`;
        const cssTop = parseFloat(getComputedStyle(card).top) || 0;
        if (cssTop + tallest > bottom) card.style.top = `${bottom - tallest}px`;
      });
      if (bottom - tallest < header + 4) {
        deck.dataset.flat = "";
        cards.forEach((card) => card.style.setProperty("--deck-p", "0"));
      }
      update();
    };

    let rafId = 0;
    const update = () => {
      if (reduced || "flat" in deck.dataset) return;
      const tops = cards.map((card) => card.getBoundingClientRect().top);
      cards.forEach((card, i) => {
        const next = tops[i + 1];
        let p = 0;
        if (next !== undefined) {
          const h = card.offsetHeight;
          p = Math.min(1, Math.max(0, (h - (next - tops[i])) / (h * 0.9)));
        }
        card.style.setProperty("--deck-p", p.toFixed(3));
      });
    };
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    let listening = false;
    const listen = (on: boolean) => {
      if (reduced || on === listening) return;
      listening = on;
      const method = on ? "addEventListener" : "removeEventListener";
      window[method]("scroll", onScroll, { passive: true } as AddEventListenerOptions);
    };
    const io = new IntersectionObserver(([entry]) => listen(entry.isIntersecting), {
      rootMargin: "100% 0px",
    });
    io.observe(deck);

    const ro = new ResizeObserver(() => layout());
    ro.observe(deck);
    window.addEventListener("resize", layout);
    layout();

    return () => {
      io.disconnect();
      ro.disconnect();
      listen(false);
      window.removeEventListener("resize", layout);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return ref;
}

export function FirstNinetyDays() {
  const deckRef = useCardDeck();

  return (
    <section id="first-90-days" className="premium-section py-14 lg:py-20">
      <SectionDivider />
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <SectionHeading
          title="Your first 90 days"
          subtitle="You sign, and we take it from there. Your monthly rhythm starts in the first month, and any backlog is cleared alongside it."
        />

        <div ref={deckRef} className="deck mt-12">
          {CARDS.map((card, i) => (
            <article
              key={card.label}
              className="deck-card"
              data-flip={i % 2 === 1 ? "" : undefined}
              style={{ "--i": i } as CSSProperties}
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
