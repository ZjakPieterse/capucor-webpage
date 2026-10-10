import Link from "next/link";
import { ArrowRight, BarChart2, BookMarked, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionDivider } from "@/components/ui/SectionDivider";

// Each discipline told as a moment the owner lives (website narrative,
// Zjak 2026-10-10). Each story names its link to the other two; the service
// pages carry the detail and the jargon.
const SERVICES = [
  {
    icon: BookMarked,
    title: "Bookkeeping",
    hook: "Know where you really stand.",
    story:
      "A big client asks for a discount and you hesitate. Is this a good month, or just a busy one? Your books are reconciled every month, so the answer is in Xero, not in your bank balance. When your report lands, we tell you what it means.",
    href: "/bookkeeping",
  },
  {
    icon: Users,
    title: "Payroll",
    hook: "Pay day, without the panic.",
    story:
      "It's the 25th. Twelve people are waiting to be paid, one worked overtime and one started on Monday. You approve the run and the payslips go out. The EMP201, UIF and COIDA follow on their own cycles, and the wages land in your books without being captured twice.",
    href: "/payroll",
  },
  {
    icon: BarChart2,
    title: "Accounting",
    hook: "No surprises from SARS.",
    story:
      "Provisional tax is due next month and you already have a good idea of the amount, because we've watched the year with you. VAT, your tax return, CIPC and the annual financials come straight from the books we keep each month, so year-end is just another month.",
    href: "/accounting",
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
            subtitle="Your payroll lands in your books, and your books become your VAT and tax returns. When different people handle each one, you end up in the middle, chasing. We run all three together, so one team knows your whole business and you hear from us all year, long before year-end."
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
