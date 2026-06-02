"use client";

import {
  Inbox,
  RefreshCw,
  CalendarCheck,
  BarChart2,
  Lightbulb,
} from "lucide-react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionDivider } from "@/components/ui/SectionDivider";

const OUTCOMES = [
  {
    icon: Inbox,
    lead: "Capture",
    rest: " documents without inbox chaos.",
  },
  {
    icon: RefreshCw,
    lead: "Reconcile",
    rest: " transactions in a live ledger.",
  },
  {
    icon: CalendarCheck,
    lead: "Track",
    rest: " deadlines and responsibilities.",
  },
  {
    icon: BarChart2,
    lead: "Report",
    rest: " the numbers clearly.",
  },
  {
    icon: Lightbulb,
    lead: "Advise",
    rest: " before problems become urgent.",
  },
];

const TOOLS = [
  { name: "Xero", monogram: "Xe" },
  { name: "Dext", monogram: "De" },
  { name: "Syft", monogram: "Sf" },
  { name: "Karbon", monogram: "Kr" },
  { name: "SimplePay", monogram: "SP" },
  { name: "Draftworx", monogram: "Dw" },
];

export function TechStackShowcase() {
  return (
    <section id="tech-stack" className="premium-section py-14 lg:py-20">
      <SectionDivider />
      <div className="max-w-7xl mx-auto px-5 sm:px-6">
        <ScrollReveal>
          <SectionHeading
            eyebrow="Our tech stack"
            title="Modern finance tools, built for your business"
            subtitle="The software is not the service. The service is how we set it up, monitor it and use it every month to keep your records, deadlines, payroll and reports under control."
          />
        </ScrollReveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-5">
          {OUTCOMES.map((o, i) => (
            <ScrollReveal key={o.lead} delay={i * 0.07}>
              <div className="outcome-card premium-card h-full rounded-2xl border border-white/10 bg-card/80 p-5 sm:p-6">
                <span
                  aria-hidden
                  className="mb-4 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-gradient-to-br from-primary/[0.18] to-primary/[0.04] text-primary shadow-[0_0_18px_-6px_color-mix(in_oklch,var(--primary)_45%,transparent)]"
                >
                  <o.icon className="h-5 w-5" />
                </span>
                <p className="text-sm leading-relaxed">
                  <span className="font-semibold text-foreground">{o.lead}</span>
                  <span className="text-muted-foreground">{o.rest}</span>
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={0.2}>
          <div className="mt-12 flex flex-col items-center gap-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70">
              The tools behind it
            </p>
            <ul
              className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4"
              role="list"
            >
              {TOOLS.map((tool) => (
                <li key={tool.name} className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-gradient-to-br from-primary/[0.14] to-primary/[0.03] font-mono text-xs font-bold tracking-tight text-primary/90"
                  >
                    {tool.monogram}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">
                    {tool.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
