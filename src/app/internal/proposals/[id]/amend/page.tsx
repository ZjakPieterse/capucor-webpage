import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireInternal } from '@/lib/auth/requireInternal';
import { getPricingData } from '@/lib/pricing/getPricingData';
import { PricingCalculator } from '@/components/pricing/PricingCalculator';
import { PricingUnavailable } from '@/components/pricing/PricingErrorBoundary';
import type { PricingSeed } from '@/hooks/usePricingState';
import type { BracketValue } from '@/types';

// Admin-only "amend" entry (PR13c): seeds the real pricing calculator from an
// existing proposal, then routes submit through /api/proposals/amend (a new
// revision that supersedes the original). Gated by the /internal layout
// (requireInternal); this page additionally requires the admin role. The hub
// renders inside the marketing chrome and opts out of the public section rhythm.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Amend proposal',
  robots: { index: false, follow: false },
};

interface AmendRow {
  id: string;
  ref_number: string | null;
  first_name: string;
  last_name: string;
  business_name: string;
  email: string;
  services: string[];
  brackets: Record<string, number>;
  tier_slug: string;
  addons: string[] | null;
  status: string;
}

function Notice({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
      <Link
        href="/internal/proposals"
        className="mt-6 inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-2"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to proposals
      </Link>
    </div>
  );
}

export default async function AmendProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // The layout already gated /internal; amend is admin-only, so re-check here.
  const internal = await requireInternal(`/internal/proposals/${id}/amend`);
  if (!internal) return null; // layout renders the "not authorised" state
  if (internal.role !== 'admin') {
    return (
      <Notice
        title="Admin access required"
        body="Amending a proposal is limited to administrators. Ask an admin to make the change."
      />
    );
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('proposals')
    .select(
      'id, ref_number, first_name, last_name, business_name, email, services, brackets, tier_slug, addons, status',
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return (
      <Notice
        title="Could not load the proposal"
        body="Something went wrong fetching this proposal. Try again from the proposals list."
      />
    );
  }

  if (!data) {
    return (
      <Notice
        title="Proposal not found"
        body="We couldn't find that proposal. It may have been removed."
      />
    );
  }

  const row = data as unknown as AmendRow;

  if (row.status === 'superseded') {
    return (
      <Notice
        title="Already replaced"
        body="This proposal has already been superseded by a newer revision. Amend the latest version instead."
      />
    );
  }

  const pricingResult = await getPricingData();
  if (!pricingResult) {
    return <PricingUnavailable />;
  }

  // Build a complete seed: every configured service gets either its stored
  // bracket or 'not_required', so Back-to-step-1 shows the whole scope answered.
  const seedBrackets: Record<string, BracketValue> = {};
  for (const service of pricingResult.pricing.services) {
    const stored = row.brackets?.[service.slug];
    seedBrackets[service.slug] = typeof stored === 'number' ? stored : 'not_required';
  }

  const seed: PricingSeed = {
    services: row.services,
    brackets: seedBrackets,
    tierSlug: row.tier_slug,
    addons: row.addons ?? [],
  };

  return (
    <div>
      <div className="mx-auto max-w-6xl px-6 pt-8">
        <Link
          href="/internal/proposals"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to proposals
        </Link>
        <div className="mt-4 rounded-xl border border-border bg-card/40 p-4">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">Amending</p>
          <p className="mt-1 text-sm">
            <span className="font-mono">{row.ref_number ?? '—'}</span>
            <span className="text-muted-foreground"> · {row.business_name}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Adjust the selection, then send. The client gets a new revision to sign and the current
            version is superseded.
          </p>
        </div>
      </div>

      <PricingCalculator
        data={pricingResult.pricing}
        testimonials={pricingResult.testimonials}
        seed={seed}
        amend={{
          proposalId: row.id,
          contact: {
            firstName: row.first_name,
            lastName: row.last_name,
            businessName: row.business_name,
            email: row.email,
          },
        }}
      />
    </div>
  );
}
