import Link from "next/link";
import { ArrowRight, BarChart2, BookMarked, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionDivider } from "@/components/ui/SectionDivider";

// Informative first (Zjak, 2026-10-11): each card says plainly what the
// discipline covers, then why it matters to the owner. The hook keeps the
// feel; the service pages carry the full detail.
const SERVICES = [
  {
    icon: BarChart2,
    title: "Accounting",
    hook: "No surprises from SARS.",
    story:
      "Your VAT returns, provisional and income tax, CIPC annual return and annual financial statements, prepared on a calendar and checked before they go in. Built from books we already keep, so you know what's coming before it's due.",
    href: "/accounting",
  },
  {
    icon: BookMarked,
    title: "Bookkeeping",
    hook: "Know where you really stand.",
    story:
      "Every transaction coded and every bank account reconciled in Xero, with management accounts and an Insights Report that explain what the numbers mean. You decide from real figures, not your bank balance.",
    href: "/bookkeeping",
  },
  {
    icon: Users,
    title: "Payroll",
    hook: "Pay day, without the panic.",
    story:
      "Payslips, PAYE and UIF on your monthly EMP201, the EMP501 with IRP5s, and your COIDA return, each on its own cycle. Wages post straight into your books, so nothing is captured twice.",
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
                <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {svc.story}
                </p>

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
