import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { TierNudge } from "@/components/pricing/TierNudge";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TIER_NUDGES } from "@/config/calculatorCopy";
import type { Service, Tier } from "@/types";

interface PackagesTeaserProps {
  services: Service[];
  tiers: Tier[];
}

// The packages differ by rhythm (package structure decision, 2026-10-06), so
// the homepage tells that story: a month of working days per package, showing
// when we process, report and review. Basic's report and review fall once a
// quarter, so its month shows them as "this quarter" markers.
type Mark = "on" | "quarter" | "off";
const DAYS = 20; // working days in a month, 4 weeks of 5
const FRIDAYS = new Set([4, 9, 14, 19]);
const MONTH_END = 19;

const every = (): Mark[] => Array.from({ length: DAYS }, () => "on");
const at = (days: Set<number> | number, mark: Mark = "on"): Mark[] =>
  Array.from({ length: DAYS }, (_, d) =>
    (typeof days === "number" ? d === days : days.has(d)) ? mark : "off",
  );

interface RhythmStory {
  rhythm: string;
  readyWhen: string;
  rows: { label: string; marks: Mark[] }[];
  highlights: string[];
}

const STORIES: Record<string, RhythmStory> = {
  basic: {
    rhythm: "Monthly rhythm",
    readyWhen:
      "Your books are in order and you want them kept that way, with a proper look at the numbers every quarter.",
    rows: [
      { label: "Process", marks: at(MONTH_END) },
      { label: "Report", marks: at(MONTH_END, "quarter") },
      { label: "Review", marks: at(MONTH_END, "quarter") },
    ],
    highlights: [
      "Processing at every monthly close",
      "Quarterly insights report",
      "Quarterly performance review",
    ],
  },
  pro: {
    rhythm: "Weekly rhythm",
    readyWhen:
      "You have staff, suppliers and VAT to keep on top of, and month-end surprises are costing you.",
    rows: [
      { label: "Process", marks: at(FRIDAYS) },
      { label: "Report", marks: at(MONTH_END) },
      { label: "Review", marks: at(MONTH_END) },
    ],
    highlights: [
      "Books processed every week",
      "Monthly insights report and review",
      "Supplier bills captured and reviewed",
    ],
  },
  premium: {
    rhythm: "Daily rhythm",
    readyWhen:
      "You make decisions every week and want close-to-live numbers and a partner on call.",
    rows: [
      { label: "Process", marks: every() },
      { label: "Report", marks: at(FRIDAYS) },
      { label: "Review", marks: at(FRIDAYS) },
    ],
    highlights: [
      "Books processed every business day",
      "Weekly insights report and review",
      "Monthly tax planning and on-call partner support",
    ],
  },
};

function MonthStrip({ rows }: { rows: RhythmStory["rows"] }) {
  return (
    <div
      role="img"
      aria-label="A month of working days showing when we process, report and review"
      className="rounded-xl border border-white/10 bg-background/40 p-3"
    >
      <div className="grid grid-cols-[3.25rem_1fr] items-center gap-x-2 gap-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <span className="text-[11px] text-muted-foreground">{row.label}</span>
            {/* Four week groups of five days, so the weeks read as weeks. */}
            <div className="grid grid-cols-4 gap-1.5">
              {[0, 1, 2, 3].map((w) => (
                <div key={w} className="grid grid-cols-5 gap-[3px]">
                  {row.marks.slice(w * 5, w * 5 + 5).map((mark, d) => (
                    <span
                      key={d}
                      className={cn(
                        "h-3 rounded-[3px]",
                        mark === "on" && "bg-primary",
                        mark === "quarter" && "border border-dashed border-primary/70",
                        mark === "off" && "bg-white/[0.06]",
                      )}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
        <span />
        <div className="flex justify-between text-[10px] text-muted-foreground/70">
          <span>Week 1</span>
          <span>Week 4</span>
        </div>
      </div>
    </div>
  );
}

export function PackagesTeaser({ tiers }: PackagesTeaserProps) {
  const sortedTiers = [...tiers]
    .sort((a, b) => a.display_order - b.display_order)
    .filter((t) => STORIES[t.slug]);

  return (
    <section className="premium-section py-14 lg:py-20">
      <SectionDivider />
      <div className="max-w-7xl mx-auto px-6">
        <ScrollReveal>
          <SectionHeading
            eyebrow="Packages"
            title="How often do you want to know where you stand?"
            subtitle="Every package includes monthly accounting, SARS and CIPC submissions and a performance review. The difference is how often we process, report and review with you."
          />
        </ScrollReveal>

        {/* Empty state — pricing config didn't load (e.g. Supabase blip). Keep
            the section honest instead of rendering a silent gap. */}
        {sortedTiers.length === 0 && (
          <ScrollReveal delay={0.1}>
            <div className="mt-10 rounded-2xl border border-white/10 bg-card/80 px-8 py-10 text-center">
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
          <>
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {sortedTiers.map((tier, i) => {
                const story = STORIES[tier.slug]!;
                const isMiddle = i === 1;
                return (
                  <ScrollReveal key={tier.slug} delay={i * 0.1} className="h-full">
                    <article
                      className={cn(
                        "premium-card flex h-full flex-col rounded-2xl border bg-card/80 p-7",
                        isMiddle ? "popular-card" : "border-white/10",
                      )}
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-semibold">{tier.name}</h3>
                          <p className="text-sm font-medium text-primary">
                            {story.rhythm}
                          </p>
                        </div>
                        {TIER_NUDGES[tier.slug] && <TierNudge tierSlug={tier.slug} />}
                      </div>

                      <MonthStrip rows={story.rows} />

                      <p className="mt-5 text-sm leading-relaxed">
                        <span className="text-muted-foreground">
                          You&apos;re ready for this when:{" "}
                        </span>
                        {story.readyWhen}
                      </p>

                      <ul className="mt-5 flex-1 space-y-2 border-t border-white/10 pt-5">
                        {story.highlights.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </article>
                  </ScrollReveal>
                );
              })}
            </div>

            <ScrollReveal delay={0.3}>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-[3px] bg-primary" /> Happens that day
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-[3px] border border-dashed border-primary/70" />{" "}
                  Once a quarter
                </span>
                <span>Payroll can be added to any package.</span>
              </div>
              <div className="mt-10 flex flex-col items-center gap-3">
                <Button
                  nativeButton={false}
                  render={<Link href="/pricing" />}
                  size="lg"
                  className="gradient-cta gap-2 w-full sm:w-auto"
                >
                  <span className="relative z-[2] inline-flex items-center gap-2">
                    See your monthly price
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Button>
                <p className="text-sm text-muted-foreground">
                  Answer a few questions and see your fee before any conversation.
                </p>
              </div>
            </ScrollReveal>
          </>
        )}
      </div>
    </section>
  );
}
