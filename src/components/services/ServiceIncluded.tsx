import { ShieldCheck } from "lucide-react";
import { SectionDivider } from "@/components/ui/SectionDivider";
import type { ServiceItem } from "@/config/servicePages";

// "What's included" on a service page: the same four items as the homepage
// card, each with what we do and what it means for the owner.
export function ServiceIncluded({ items }: { items: ServiceItem[] }) {
  return (
    <section className="premium-section py-14 lg:py-20">
      <SectionDivider />
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-2xl font-semibold mb-8 text-center">What&apos;s included</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {items.map((item) => (
            <article
              key={item.title}
              className="feature-card premium-card flex flex-col rounded-xl border border-white/10 bg-card/80 p-6"
            >
              <h3 className="text-base font-semibold mb-2">{item.title}</h3>
              <p className="flex-1 text-sm text-muted-foreground leading-relaxed">
                {item.description}
              </p>
              <p className="mt-4 flex items-start gap-2.5 border-t border-white/10 pt-4 text-sm text-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-foreground/60" aria-hidden />
                {item.covered}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
