import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ServicePillars } from '@/components/landing/ServicePillars';
import { RevealObserver } from '@/components/ui/RevealObserver';

// TEMPORARY, dev only: the two service-card designs side by side for Zjak to
// choose from (premium polish, 2026-10-12). Delete this page, and the losing
// variant, before the PR merges.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function ServicesPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <>
      <RevealObserver />
      <p className="mx-auto max-w-7xl px-6 pt-10 text-sm font-semibold uppercase tracking-widest text-primary">
        Option A: connected flow
      </p>
      <ServicePillars variant="flow" />
      <p className="mx-auto max-w-7xl px-6 pt-10 text-sm font-semibold uppercase tracking-widest text-primary">
        Option B: refined minimal
      </p>
      <ServicePillars variant="minimal" />
    </>
  );
}
