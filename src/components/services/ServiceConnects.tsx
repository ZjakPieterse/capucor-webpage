import { ArrowRight, BarChart2, BookMarked, Users, type LucideIcon } from "lucide-react";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { SERVICE_PAGES, type ServicePage } from "@/config/servicePages";

export const SERVICE_ICONS: Record<ServicePage["slug"], LucideIcon> = {
  accounting: BarChart2,
  bookkeeping: BookMarked,
  payroll: Users,
};

// "How it connects" at the foot of a service page: the other two disciplines,
// with the same title and hook as their homepage cards.
export function ServiceConnects({ current }: { current: ServicePage["slug"] }) {
  return (
    <section className="premium-section py-14 lg:py-20">
      <SectionDivider />
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-lg font-semibold mb-6 text-muted-foreground">How it connects</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {SERVICE_PAGES.filter((svc) => svc.slug !== current).map((svc) => {
            const Icon = SERVICE_ICONS[svc.slug];
            return (
              <a
                key={svc.slug}
                href={svc.href}
                className="feature-card premium-card flex items-center gap-4 rounded-xl border border-white/10 bg-card/80 px-6 py-5"
              >
                <span
                  aria-hidden
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/[0.07] text-primary"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">{svc.title}</span>
                  <span className="text-xs font-medium text-foreground/75">{svc.hook}</span>
                </span>
                <ArrowRight aria-hidden className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
