import Link from "next/link";
import { ArrowRight, Check, ChevronDown, ChevronRight } from "lucide-react";
import { SERVICE_ICONS } from "@/components/services/ServiceConnects";
import { SERVICE_PAGES, type ServicePage } from "@/config/servicePages";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { cn } from "@/lib/utils";

// Cards and service pages share one source (config/servicePages.ts), so each
// card's four items are the four cards under that page's "What's included".
//
// Two designs are on trial (premium polish, Zjak 2026-10-12): "flow" tells the
// heading's claim in the order the work moves (payroll feeds the books, the
// books feed the returns) with lit connectors between the cards; "minimal"
// keeps the current order with a quieter, refined card. One is kept.
export type ServicePillarsVariant = "flow" | "minimal";

const FLOW_ORDER: ServicePage["slug"][] = ["payroll", "bookkeeping", "accounting"];

// What each discipline hands on, told on the flow cards.
const FLOW_OUTPUT: Record<ServicePage["slug"], string> = {
  payroll: "Wages, PAYE and UIF flow into your books",
  bookkeeping: "Reconciled numbers feed your returns",
  accounting: "Returns filed with SARS and CIPC",
};

export function ServicePillars({ variant = "flow" }: { variant?: ServicePillarsVariant }) {
  const flow = variant === "flow";
  const services = flow
    ? FLOW_ORDER.map((slug) => SERVICE_PAGES.find((s) => s.slug === slug)!)
    : SERVICE_PAGES;

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

        <div
          className={cn(
            "mt-12 grid",
            flow
              ? "svc-flow mx-auto max-w-xl gap-10 lg:max-w-none lg:grid-cols-3 lg:gap-10"
              : "gap-6 sm:grid-cols-2 lg:grid-cols-3",
          )}
        >
          {services.map((svc, i) => {
            const Icon = SERVICE_ICONS[svc.slug];
            return (
              <ScrollReveal key={svc.slug} delay={i * 0.1} className="h-full">
                <article
                  className="svc-card flex h-full flex-col rounded-[22px] p-7"
                  style={{ "--i": i } as React.CSSProperties}
                >
                  {flow && i > 0 && (
                    <>
                      <span aria-hidden className="svc-connector hidden lg:flex">
                        <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                      <span aria-hidden className="svc-connector-v flex lg:hidden">
                        <ChevronDown className="h-3.5 w-3.5" />
                      </span>
                    </>
                  )}

                  <div className="flex items-start justify-between gap-4">
                    <span aria-hidden className="svc-orb">
                      <Icon className="h-[22px] w-[22px]" />
                    </span>
                    <span aria-hidden className="svc-index">
                      0{i + 1}
                    </span>
                  </div>

                  <h3 className="mt-6 text-2xl font-semibold tracking-tight">{svc.title}</h3>
                  <p className="mt-1.5 text-[0.9375rem] font-medium text-primary">{svc.hook}</p>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    {svc.body}
                  </p>

                  <ul className="svc-list mt-6 flex-1">
                    {svc.items.map(({ title: item }) => (
                      <li key={item}>
                        <span className="svc-check" aria-hidden>
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>

                  {flow && <p className="svc-output">{FLOW_OUTPUT[svc.slug]}</p>}

                  <Link href={svc.href} className="svc-link">
                    Read more
                    <span className="sr-only"> about {svc.title.toLowerCase()}</span>
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </article>
              </ScrollReveal>
            );
          })}
        </div>

        <ScrollReveal delay={0.3}>
          <div className="mt-12 text-center">
            {/* The same flagship button as the hero and Your first 90 days. */}
            <Button
              nativeButton={false}
              render={<Link href="/pricing" />}
              size="lg"
              className="gradient-cta gap-2"
            >
              <span className="relative z-[2] inline-flex items-center gap-2">
                Build your subscription <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </Button>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
