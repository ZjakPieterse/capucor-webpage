"use client";

import { Calendar, CalendarCheck, History, PhoneCall, Settings2 } from "lucide-react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

// Onboarding steps (website-v2, message pillar 4: switch in any month).
// How catch-up is charged is part of the open pricing decision, so no amounts
// or durations appear here until that is settled.
const STEPS = [
  {
    number: "01",
    icon: PhoneCall,
    title: "Fit call",
    body: "We look at where your books, payroll and SARS profile stand today.",
  },
  {
    number: "02",
    icon: Settings2,
    title: "Set-up",
    body: "We set up Xero, Dext and your bank feeds, and take over payroll on its next cycle.",
  },
  {
    number: "03",
    icon: History,
    title: "Catch-up",
    body: "We bring the backlog up to date and check what's outstanding with SARS.",
  },
  {
    number: "04",
    icon: CalendarCheck,
    title: "First month",
    body: "Your first month closes on the rhythm, with a report and a conversation.",
  },
];

export function SwitchingSection() {
  return (
    <section id="switching" className="premium-section py-14 lg:py-20">
      <SectionDivider />
      <div className="max-w-7xl mx-auto px-6">
        <ScrollReveal>
          <SectionHeading
            eyebrow="Getting started"
            title="Switching in any month"
            subtitle="You don't have to wait for year-end. Start in whichever month suits you, and we take it from there."
          />
        </ScrollReveal>

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {STEPS.map((step, i) => (
            <li key={step.number} className="h-full">
              <ScrollReveal delay={i * 0.08} className="h-full">
                <article className="feature-card premium-card flex h-full flex-col rounded-2xl border border-white/10 bg-card/80 p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <span
                      aria-hidden
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.07] text-primary"
                    >
                      <step.icon className="h-5 w-5" />
                    </span>
                    <span
                      aria-hidden
                      className="font-mono text-sm font-semibold text-muted-foreground"
                    >
                      {step.number}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold mb-2">
                    <span className="sr-only">Step {i + 1}: </span>
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.body}
                  </p>
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
