"use client";

import { BarChart2, BookMarked, Users, Wallet, KeyRound, Unlock } from "lucide-react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionDivider } from "@/components/ui/SectionDivider";

const SERVICES = [
  {
    icon: BarChart2,
    title: "Accounting",
    pitch:
      "Your financials and filings are ready before SARS, the bank or a funder asks.",
    bestFor:
      "Companies that need AFS, income tax, VAT and CIPC responsibilities managed by professionals.",
    bullets: [
      "Annual financial statements",
      "Income tax and provisional tax",
      "VAT201 reporting and submission",
      "CIPC annual return filings",
    ],
    href: "/accounting",
    ctaLabel: "View accounting support",
  },
  {
    icon: BookMarked,
    title: "Bookkeeping",
    pitch:
      "Make decisions using current numbers rather than gut feel and bank balance.",
    bestFor:
      "Businesses that want their ledger processed, reconciled and ready for decisions every month.",
    bullets: [
      "Xero business software included",
      "Transaction processing and categorisation",
      "Monthly bank reconciliations",
      "Monthly management accounts",
    ],
    href: "/bookkeeping",
    ctaLabel: "View bookkeeping support",
    featured: true,
  },
  {
    icon: Users,
    title: "Payroll",
    pitch:
      "Pay staff correctly and keep monthly submissions off your worry list.",
    bestFor:
      "Employers that want payroll handled correctly, confidentially and on time.",
    bullets: [
      "Payroll processing and payslips",
      "PAYE and UIF submissions",
      "COIDA compliance",
      "IRP5 certificates",
    ],
    href: "/payroll",
    ctaLabel: "View payroll support",
  },
];

// What the subscription is worth to the buyer — every claim is true elsewhere on the site.
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

export function ServicePillars() {
  return (
    <section
      id="services"
      className="premium-section py-14 lg:py-20"
    >
      <SectionDivider />
      <div className="max-w-7xl mx-auto px-6">
        <ScrollReveal>
          <SectionHeading
            eyebrow="What we do"
            title="Three disciplines. One subscription."
            subtitle="Accounting, bookkeeping, and payroll. All on one flat monthly subscription."
          />
        </ScrollReveal>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {SERVICES.map((svc, i) => (
            <ScrollReveal key={svc.title} delay={i * 0.1}>
              <div className="feature-card premium-card group rounded-2xl border border-white/10 bg-card/80 p-8 h-full">
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-muted/70">
                  <svc.icon className="h-5 w-5 text-foreground" />
                </div>

                <h3 className="text-xl font-semibold mb-2">{svc.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  {svc.pitch}
                </p>

                <p className="text-xs leading-relaxed mb-5">
                  <span className="font-semibold text-foreground">
                    Best for:{" "}
                  </span>
                  <span className="text-muted-foreground">{svc.bestFor}</span>
                </p>

                <ul className="space-y-2 mb-6">
                  {svc.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>

                <a
                  href={svc.href}
                  className="text-sm font-medium text-primary hover:underline underline-offset-4"
                >
                  {svc.ctaLabel} →
                </a>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={0.3}>
          <div className="mt-12 text-center">
            <a
              href="/pricing"
              className="premium-button inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Build your subscription →
            </a>
          </div>
        </ScrollReveal>

        {/* What that means for you — the trust / ROI payload (moved here from the Tech Stack section) */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    </section>
  );
}
