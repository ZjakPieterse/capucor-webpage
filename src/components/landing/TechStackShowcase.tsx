"use client";

import {
  Receipt,
  Database,
  ListChecks,
  BarChart3,
  ChevronRight,
  Wallet,
  KeyRound,
  Unlock,
} from "lucide-react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionDivider } from "@/components/ui/SectionDivider";

// The connected system the client journeys through. Each stage names the tool
// that powers it (a reference, not a sell) and states the outcome for the client.
// This is the software system; HowItWorks covers the human monthly rhythm.
const STAGES = [
  {
    icon: Receipt,
    tool: "Dext",
    title: "Documents in",
    body: "Forward invoices and receipts once. They land in one place, not lost in an inbox.",
  },
  {
    icon: Database,
    tool: "Xero",
    title: "Your live ledger",
    body: "Everything posts to Xero, your single source of truth, with your own login to see it any time.",
  },
  {
    icon: ListChecks,
    tool: "Karbon",
    title: "Tracked and on time",
    body: "Every request, deadline and responsibility runs through one workflow, so nothing rides on memory.",
  },
  {
    icon: BarChart3,
    tool: "Syft",
    title: "Clear reporting",
    body: "Your numbers become reports you can actually read, not a spreadsheet to decode.",
  },
];

// What the stack is worth to the buyer — every claim is true elsewhere on the site.
const TRUST = [
  {
    icon: Wallet,
    title: "Included in your price",
    body: "Your software costs are built into the subscription. No separate software bills to manage.",
  },
  {
    icon: KeyRound,
    title: "Your own login",
    body: "You keep full, real-time access to your numbers. Outsourcing the admin doesn't cost you visibility.",
  },
  {
    icon: Unlock,
    title: "No lock-in",
    body: "A month-to-month agreement. If you leave, your full Xero file and handover pack goes with you.",
  },
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

        {/* The connected-system journey */}
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map((s, i) => (
            <ScrollReveal key={s.tool} delay={i * 0.07} className="relative h-full">
              {i > 0 && (
                <span aria-hidden className="tech-connector hidden lg:block">
                  <ChevronRight />
                </span>
              )}
              <div className="outcome-card premium-card flex h-full flex-col items-center rounded-2xl border border-white/10 bg-card/80 p-5 text-center sm:p-6">
                <span
                  aria-hidden
                  className="mb-4 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-gradient-to-br from-primary/[0.18] to-primary/[0.04] text-primary shadow-[0_0_18px_-6px_color-mix(in_oklch,var(--primary)_45%,transparent)]"
                >
                  <s.icon className="h-5 w-5" />
                </span>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">
                  {s.tool}
                </p>
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* Payroll runs as a parallel stream into the same ledger */}
        <ScrollReveal delay={0.1}>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Payroll runs in parallel through{" "}
            <span className="font-medium text-foreground">SimplePay</span> and feeds
            into the same ledger.
          </p>
        </ScrollReveal>

        {/* What that means for you — the trust / ROI payload */}
        <div className="mt-14 lg:mt-16">
          <ScrollReveal>
            <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70">
              What that means for you
            </p>
          </ScrollReveal>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TRUST.map((t, i) => (
              <ScrollReveal key={t.title} delay={i * 0.07} className="h-full">
                <div className="feature-card premium-card flex h-full items-start gap-3.5 rounded-2xl border border-white/10 bg-card/80 p-5">
                  <span
                    aria-hidden
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/[0.07] text-primary"
                  >
                    <t.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {t.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {t.body}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
