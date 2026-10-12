"use client";

import Link from "next/link";
import { ArrowRight, Calendar, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { siteConfig } from "@/config/site";
import { useSectionScrollProgress } from "@/hooks/useSectionScrollProgress";
import { useTimelineReach } from "@/hooks/useTimelineReach";

// A new client's first 90 days, told once (90-day roadmap interview,
// 2026-10-12). How it works is every month; this is the road to the first
// normal quarter. Two tracks: the monthly rhythm starts in the first 30 days
// and catch-up runs alongside, never ahead of it. Catch-up rule (pricing
// figures decision, 2026-10-06): the 3 months before acceptance are included;
// older work is quoted. Each band says what is done by its end, never how long
// a step takes. No amounts, packages, response times or bank feeds, and never
// "your logins": the software is ours and we hand your records over if you
// leave.
const STAGES = [
  {
    days: "Days 1–30",
    title: "Set up",
    body: "You sign, and one email arrives with a short list of what we need. We set you up on Xero, and on SimplePay if you have staff, all included in your fee. Your monthly rhythm starts. Behind on your books? The 3 months before you signed are included. Anything older we quote upfront and run alongside, so it never holds up your month.",
    milestone: "By day 30: set up, with your monthly rhythm running.",
  },
  {
    days: "Days 31–60",
    title: "Settle",
    body: "This is the month you stop chasing. Your books are processed and payroll and VAT go out on their cycles, while the months before you joined are brought up to date. We’ve checked your SARS profile, so you know what’s outstanding and the plan to clear it.",
    milestone: "By day 60: your books current and your SARS position clear.",
  },
  {
    days: "Days 61–90",
    title: "Review",
    body: "We sit down for your 90-day review: what we found, what we’ve fixed and what comes next. Tell us what’s working and what isn’t. You leave with a plan for the next quarter, and you stay because it works: month to month on 30 days’ notice. If you ever leave, we hand over your Xero file and SARS eFiling.",
    milestone: "By day 90: your review done and the next quarter planned.",
  },
];

// Same list as the welcome checklist sent on signing.
const NEEDS = [
  "Your company registration (CIPC) details and SARS tax numbers",
  "Your UIF and COIDA references, if you’re registered",
  "Access to your Xero if you already use it, and to SARS eFiling",
  "Opening balances: last financial statements, trial balance, detailed ledger if you have it, debtors and creditors, and your fixed asset register",
  "Your latest payroll run and employee details",
  "Your go-ahead to ask your previous accountant for anything you can’t find",
];

export function FirstNinetyDays() {
  const { ref: timelineRef } = useSectionScrollProgress<HTMLDivElement>();
  useTimelineReach(timelineRef);

  return (
    <section
      id="first-90-days"
      className="how-timeline-section premium-section roadmap-timeline"
    >
      <SectionDivider />
      <div className="mx-auto w-full max-w-6xl px-6">
        <SectionHeading
          title="Your first 90 days"
          subtitle="You sign, and we take it from there. Your monthly rhythm starts in the first month, and any backlog is cleared alongside it."
        />

        <div ref={timelineRef} className="how-timeline mt-12">
          <div className="how-spine" aria-hidden="true" />
          {STAGES.map((stage, i) => (
            <div
              key={stage.days}
              className="how-step-row"
              data-side={i % 2 === 0 ? "left" : "right"}
            >
              <div className="how-badge how-badge-pill" aria-hidden="true">
                {stage.days}
              </div>
              <article
                className="how-card"
                aria-label={`${stage.days}: ${stage.title}`}
              >
                <h3 className="how-card-title">{stage.title}</h3>
                <p className="how-card-body">{stage.body}</p>
                <p className="roadmap-milestone">{stage.milestone}</p>
              </article>
            </div>
          ))}
        </div>

        <div className="premium-card mx-auto mt-14 max-w-4xl rounded-2xl border border-white/10 bg-card/80 p-6 sm:p-8">
          <h3 className="text-xl font-semibold">What we&apos;ll need from you</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            One list, sent when you sign. The sooner it&apos;s back, the sooner your rhythm starts.
          </p>
          <ul className="mt-5 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-2 sm:gap-x-8">
            {NEEDS.map((need) => (
              <li key={need} className="flex items-start gap-2.5 text-sm leading-relaxed">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                {need}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
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
