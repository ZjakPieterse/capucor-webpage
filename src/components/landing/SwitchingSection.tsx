"use client";

import { Calendar } from "lucide-react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

// The first 90 days after a client signs (website-v2, message pillar 4:
// switch in any month). Catch-up rule (pricing figures decision, 2026-10-06):
// the 3 months before acceptance are included; older work is quoted or billed
// hourly. No amounts and no turnaround times: promise only what we run.
const PHASES = [
  {
    days: "Days 1–30",
    title: "Set up and catch up",
    steps: [
      "A kick-off call, then access to Xero, your bank feeds, SARS eFiling and payroll.",
      "The 3 months before you sign are brought up to date. Anything older we quote upfront.",
      "We check what's outstanding with SARS and take over payroll on its next cycle.",
    ],
    outcome: "Current books and a clear SARS position.",
    fromYou: "Logins, recent bank statements and your last payroll run.",
  },
  {
    days: "Days 31–60",
    title: "On your rhythm",
    steps: [
      "Processing runs on your package rhythm: monthly, weekly or daily.",
      "Your first monthly close, with VAT and payroll submissions on their cycles.",
      "Anything we found in the catch-up gets sorted.",
    ],
    outcome: "A month closed on time, without you chasing it.",
    fromYou: "Invoices and slips as they come in.",
  },
  {
    days: "Days 61–90",
    title: "Your first review",
    steps: [
      "A performance review of your first quarter with us.",
      "Baseline numbers to measure the next quarter against.",
      "A short list of what to fix or change next.",
    ],
    outcome: "A plan for the next quarter, agreed together.",
    fromYou: "An hour for the review.",
  },
];

export function SwitchingSection() {
  return (
    <section id="switching" className="premium-section py-14 lg:py-20">
      <SectionDivider />
      <div className="max-w-7xl mx-auto px-6">
        <ScrollReveal>
          <SectionHeading
            eyebrow="Your first 90 days"
            title="Start in any month"
            subtitle="You don't have to wait for year-end. Here is what happens from the day you sign to your first review."
          />
        </ScrollReveal>

        <ol className="relative mt-12 grid gap-6 lg:grid-cols-3">
          {/* The track the three phases sit on (desktop only). */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-[16.66%] right-[16.66%] top-5 hidden h-px bg-gradient-to-r from-primary/60 via-primary/30 to-primary/60 lg:block"
          />
          {PHASES.map((phase, i) => (
            <li key={phase.days} className="relative h-full">
              <ScrollReveal delay={i * 0.1} className="h-full">
                <div className="mb-4 flex justify-center">
                  <span className="relative z-[1] inline-flex h-10 items-center rounded-full border border-primary/30 bg-background px-4 font-mono text-sm font-semibold text-primary">
                    {phase.days}
                  </span>
                </div>
                <article className="feature-card premium-card flex h-full flex-col rounded-2xl border border-white/10 bg-card/80 p-6">
                  <h3 className="mb-4 text-lg font-semibold">
                    <span className="sr-only">Phase {i + 1}: </span>
                    {phase.title}
                  </h3>
                  <ul className="flex-1 space-y-3">
                    {phase.steps.map((step) => (
                      <li
                        key={step}
                        className="flex gap-3 text-sm leading-relaxed text-muted-foreground"
                      >
                        <span
                          aria-hidden
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70"
                        />
                        {step}
                      </li>
                    ))}
                  </ul>
                  <dl className="mt-6 space-y-3 border-t border-white/10 pt-4 text-sm">
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wider text-primary">
                        You&apos;ll have
                      </dt>
                      <dd className="mt-1 font-medium">{phase.outcome}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        What we need from you
                      </dt>
                      <dd className="mt-1 text-muted-foreground">
                        {phase.fromYou}
                      </dd>
                    </div>
                  </dl>
                </article>
              </ScrollReveal>
            </li>
          ))}
        </ol>

        <ScrollReveal delay={0.3}>
          <div className="mt-10 flex justify-center">
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
        </ScrollReveal>
      </div>
    </section>
  );
}
