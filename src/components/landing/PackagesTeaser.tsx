import Link from "next/link";
import { Check } from "lucide-react";
import { CoreServicesPanel } from "@/components/pricing/CoreServicesPanel";
import { TierNudge } from "@/components/pricing/TierNudge";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { cn } from "@/lib/utils";
import {
  TIER_HIGHLIGHTS,
  packageCommonItemsFor,
  TIER_BUYER_FIT,
} from "@/config/tiers";
import { TIER_NUDGES } from "@/config/calculatorCopy";
import type { Service, Tier } from "@/types";

interface PackagesTeaserProps {
  services: Service[];
  tiers: Tier[];
}


function getDisplayItems(
  tierSlug: string,
): { text: string; tooltip: string }[] {
  return (TIER_HIGHLIGHTS[tierSlug] ?? [])
    .filter((i) => !i.calculatorOnly)
    .map((i) => ({ text: i.text, tooltip: i.tooltip }));
}

export function PackagesTeaser({ tiers }: PackagesTeaserProps) {
  const sortedTiers = [...tiers].sort(
    (a, b) => a.display_order - b.display_order,
  );

  return (
    <section className="premium-section py-14 lg:py-20">
      <SectionDivider />
      <div className="max-w-7xl mx-auto px-6">
        <ScrollReveal>
          <SectionHeading
            title="Choose the level of support your business needs right now"
            subtitle="Every package includes the core accounting and bookkeeping. Choose how often we process, report and review with you. You see the monthly fee before any conversation, and your subscription can grow with the business."
          />
        </ScrollReveal>

        {/* The same core services panel as the calculator's packages step,
            so both read as one product (tweaks round 3). */}
        <ScrollReveal delay={0.1}>
          <div className="mt-10">
            <CoreServicesPanel items={packageCommonItemsFor(true)} />
          </div>
        </ScrollReveal>

        {/* Empty state — pricing config didn't load (e.g. Supabase blip). Keep
            the section honest instead of rendering a silent gap. */}
        {sortedTiers.length === 0 && (
          <ScrollReveal delay={0.1}>
            <div className="mt-6 rounded-2xl border border-white/10 bg-card/80 px-8 py-10 text-center">
              <p className="text-sm text-muted-foreground mb-5">
                Package details aren&apos;t loading right now. You can still build
                your subscription on the pricing page.
              </p>
              <Link
                href="/pricing"
                className="premium-button inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all"
              >
                Build your subscription →
              </Link>
            </div>
          </ScrollReveal>
        )}

        {sortedTiers.length > 0 && (
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedTiers.map((tier, i) => {
            const isMiddle = i === 1;
            const displayItems = getDisplayItems(tier.slug);
            const nudge = TIER_NUDGES[tier.slug];

            return (
              <ScrollReveal key={tier.slug} delay={i * 0.1}>
                <div
                  className={cn(
                    "premium-card rounded-2xl border bg-card/80 p-8 flex flex-col h-full",
                    isMiddle ? "popular-card" : "border-white/10",
                  )}
                >
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-1">{tier.name}</h3>
                    {TIER_BUYER_FIT[tier.slug] ? (
                      <p className="text-sm text-muted-foreground">
                        {TIER_BUYER_FIT[tier.slug]}
                      </p>
                    ) : tier.tagline ? (
                      <p className="text-sm text-muted-foreground">
                        {tier.tagline}
                      </p>
                    ) : null}
                  </div>

                  {nudge && (
                    <div className="mb-4">
                      <TierNudge tierSlug={tier.slug} />
                    </div>
                  )}

                  <ul className="space-y-2 flex-1">
                    {displayItems.map((item) => (
                      <li
                        key={item.text}
                        className="flex items-start gap-2 text-sm"
                      >
                        <Check className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                        <span>{item.text}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 flex justify-center">
                    {/* Every package, Premium included, starts in the
                        calculator (tweaks round 1: no Book a call on Premium). */}
                    <Link
                      href="/pricing"
                      className="premium-button inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all"
                    >
                      Build your subscription →
                    </Link>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
        )}
      </div>
    </section>
  );
}
