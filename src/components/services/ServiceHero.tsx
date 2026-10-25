import type { ReactNode } from "react";
import { ServiceCtaPair } from "@/components/services/ServiceCtaPair";
import { SERVICE_ICONS } from "@/components/services/ServiceConnects";
import type { ServicePage } from "@/config/servicePages";

// A calm, text-only hero for the service pages (Zjak, 2026-10-11): no animated
// panel, so the reader goes straight to what the discipline covers.
export function ServiceHero({
  service,
  title,
  children,
}: {
  service: ServicePage;
  title: ReactNode;
  children: ReactNode;
}) {
  const Icon = SERVICE_ICONS[service.slug];
  return (
    <section className="premium-section relative py-20 lg:py-24">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <span
          aria-hidden
          className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.07] text-primary"
        >
          <Icon className="h-6 w-6" />
        </span>
        <h1 className="text-4xl lg:text-5xl font-semibold tracking-tight mb-6 leading-[1.1]">
          {title}
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-2xl mx-auto">
          {children}
        </p>
        <ServiceCtaPair centered />
      </div>
    </section>
  );
}
