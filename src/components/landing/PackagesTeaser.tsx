import Link from "next/link";
import { CalendarCheck, Check, ShieldCheck, Users } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { cn } from "@/lib/utils";
import {
  TIER_HIGHLIGHTS,
  TIER_CUMULATIVE_LABELS,
  PACKAGE_COMMON_ITEMS,
  TIER_BUYER_FIT,
} from "@/config/tiers";
import type { Service, Tier } from "@/types";

interface PackagesTeaserProps {
  services: Service[];
  tiers: Tier[];
}

function getDisplayItems(
  tierSlug: string,
): { text: string; tooltip: string }[] {
  const items = (TIER_HIGHLIGHTS[tierSlug] ?? [])
    .filter((i) => !i.calculatorOnly)
    .map((i) => ({ text: i.text, tooltip: i.tooltip }));
  const label = TIER_CUMULATIVE_LABELS[tierSlug];
  if (label) return [{ text: label, tooltip: "" }, ...items];
  return items;
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
            eyebrow="Packages"
            title="Choose the level of support your business needs right now"
            subtitle="Start with the services you need, then choose the depth of monthly support. You see the monthly fee before any conversation, and your subscription can grow as the business becomes more complex."
          />
        </ScrollReveal>

        {/* Included in every package */}
        <ScrollReveal delay={0.1}>
          <div className="premium-glass mt-10 rounded-2xl border border-white/10 bg-card/75 px-8 py-6">
            <p className="text-xs font-medium uppercase tracking-widest text-center text-muted-foreground mb-5">
              Included in every package
            </p>
            <div className="flex flex-wrap justify-center gap-8">
              {PACKAGE_COMMON_ITEMS.map((item, idx) => {
                const Icon =
                  idx === 0 ? Users : idx === 1 ? ShieldCheck : CalendarCheck;
                return (
                  <div key={item.text} className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-medium">{item.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollReveal>

        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedTiers.map((tier, i) => {
            const isMiddle = i === 1;
            const displayItems = getDisplayItems(tier.slug);

            return (
              <ScrollReveal key={tier.slug} delay={i * 0.1}>
                <div
                  className={cn(
                    "premium-card rounded-2xl border bg-card/80 p-8 flex flex-col h-full",
                    isMiddle
                      ? "border-primary/40 shadow-lg shadow-primary/10 relative"
                      : "border-white/10",
                  )}
                >
                  {isMiddle && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                        Most popular
                      </span>
                    </div>
                  )}

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
      </div>
    </section>
  );
}
