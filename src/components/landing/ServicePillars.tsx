import Link from "next/link";
import { ArrowRight, BarChart2, BookMarked, Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionDivider } from "@/components/ui/SectionDivider";

// Each card: what it means for the owner, then the four things it covers,
// named as the packages and service pages name them (Zjak, 2026-10-11).
const SERVICES = [
  {
    icon: BarChart2,
    title: "Accounting",
    hook: "No surprises from SARS.",
    body: "Your tax and filings are done before anyone asks, so you know what's due before it lands. When the bank wants financials, they're ready.",
    covers: [
      "Annual financial statements",
      "Income and provisional tax",
      "VAT201 returns, if you're registered",
      "CIPC annual returns",
    ],
    href: "/accounting",
  },
  {
    icon: BookMarked,
    title: "Bookkeeping",
    hook: "Know where you really stand.",
    body: "You decide from real numbers, not your bank balance. Each report comes with an accountant who tells you what changed and what to do next.",
    covers: [
      "Xero accounting software included",
      "Transactions processed and coded",
      "Bank accounts reconciled",
      "Insights Report and performance review",
    ],
    href: "/bookkeeping",
  },
  {
    icon: Users,
    title: "Payroll",
    hook: "Pay day, without the panic.",
    body: "Your people are paid correctly, and you stop carrying SARS dates in your head. Wages flow straight into your books, so nothing is captured twice.",
    covers: [
      "Payroll processing and payslips",
      "EMP201: PAYE and UIF every month",
      "EMP501 and IRP5 certificates",
      "COIDA Return of Earnings",
    ],
    href: "/payroll",
  },
];

export function ServicePillars() {
  return (
    <section id="services" className="premium-section py-14 lg:py-20">
      <SectionDivider />
      <div className="max-w-7xl mx-auto px-6">
        <ScrollReveal>
          <SectionHeading
            title="Three disciplines. One subscription."
            subtitle="Payroll feeds your books, and your books feed your SARS returns. We run all three together, so you hear from us all year."
          />
        </ScrollReveal>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((svc, i) => (
            <ScrollReveal key={svc.title} delay={i * 0.1} className="h-full">
              <article className="feature-card premium-card flex h-full flex-col rounded-2xl border border-white/10 bg-card/80 p-7">
                <span
                  aria-hidden
                  className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.07] text-primary"
                >
                  <svc.icon className="h-5 w-5" />
                </span>

                <h3 className="text-xl font-semibold">{svc.title}</h3>
                <p className="mt-1 text-sm font-medium text-primary">{svc.hook}</p>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {svc.body}
                </p>

                <ul className="mt-5 flex-1 space-y-2 border-t border-white/10 pt-5">
                  {svc.covers.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>

                <Button
                  nativeButton={false}
                  render={<Link href={svc.href} />}
                  variant="outline"
                  size="lg"
                  className="mt-6 self-start gap-2"
                >
                  Read more
                  <span className="sr-only"> about {svc.title.toLowerCase()}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </article>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={0.3}>
          <div className="mt-12 text-center">
            <a
              href="/pricing"
              className="premium-button inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
            >
              Build your subscription →
            </a>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
