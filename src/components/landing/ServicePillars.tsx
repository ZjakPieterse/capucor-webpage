import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { SERVICE_ICONS } from "@/components/services/ServiceConnects";
import { SERVICE_PAGES } from "@/config/servicePages";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionDivider } from "@/components/ui/SectionDivider";

// Cards and service pages share one source (config/servicePages.ts), so each
// card's four items are the four cards under that page's "What's included".
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
          {SERVICE_PAGES.map((svc, i) => {
            const Icon = SERVICE_ICONS[svc.slug];
            return (
              <ScrollReveal key={svc.title} delay={i * 0.1} className="h-full">
                <article className="feature-card premium-card flex h-full flex-col rounded-2xl border border-white/10 bg-card/80 p-7">
                  <span
                    aria-hidden
                    className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.07] text-primary"
                  >
                    <Icon className="h-5 w-5" />
                  </span>
  
                  <h3 className="text-xl font-semibold">{svc.title}</h3>
                  <p className="mt-1 text-sm font-medium text-primary">{svc.hook}</p>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    {svc.body}
                  </p>
  
                  <ul className="mt-5 flex-1 space-y-2 border-t border-white/10 pt-5">
                    {svc.items.map(({ title: item }) => (
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
