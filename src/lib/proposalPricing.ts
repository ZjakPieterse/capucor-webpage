/**
 * Server-side, anti-tamper pricing for a proposal selection.
 *
 * The client only ever sends config (services / brackets / tier / add-ons).
 * Prices come from the live `brackets` table here, so the client cannot tamper
 * with them. In this repo the consumers are /api/proposals (create) and the
 * signing flow; capucor-os runs the same code for the staff amend form.
 *
 * ⚠️ HAND-SYNCED with capucor-os/src/lib/proposalPricing.ts — as are
 * ./pricing.ts and ../config/tiers.ts. Both repos price the same proposals off
 * the same `brackets` table. Change the math in one and not the other and the
 * two surfaces quote different numbers for the same selection, with nothing to
 * catch it: no compile error, no failing test. Change it here, change it there,
 * and keep pricing.test.ts passing in both.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db';
import {
  monthlyTotal,
  buildLineItems,
  addonTotal,
  buildAddonLineItems,
  type ProposalLineItem,
} from '@/lib/pricing';
import { PRICING_ADDONS } from '@/config/tiers';
import type { Bracket } from '@/types';

type BracketRow = Pick<
  Bracket,
  'service_slug' | 'ordinal' | 'label' | 'basic_price' | 'pro_price' | 'premium_price'
>;

export interface ProposalSelectionInput {
  services: string[];
  brackets: Record<string, number>;
  tierSlug: string;
  addons: string[];
}

export interface PricedSelection {
  addonSlugs: string[];
  lineItems: ProposalLineItem[];
  monthlyTotalZAR: number;
  vatZAR: number;
  totalChargeZAR: number;
}

export type PriceResult =
  | { ok: true; data: PricedSelection }
  | { ok: false; error: string; status: number };

function titleCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export async function priceProposalSelection(
  admin: SupabaseClient<Database>,
  input: ProposalSelectionInput,
): Promise<PriceResult> {
  let bracketRows: BracketRow[];
  try {
    const { data, error } = await admin
      .from('brackets')
      .select('service_slug, ordinal, label, basic_price, pro_price, premium_price')
      .in('service_slug', input.services)
      .returns<BracketRow[]>();

    if (error || !data) throw error ?? new Error('Brackets fetch returned no rows');
    bracketRows = data;
  } catch (err) {
    console.error('[proposalPricing] brackets fetch failed:', err);
    return { ok: false, error: 'Could not price your proposal. Please try again.', status: 500 };
  }

  // Add-ons: whitelist against the shared config before pricing. The bracket
  // total alone must clear the > 0 guard — an add-on can't carry a proposal.
  const addonSlugs = [...new Set(input.addons)].filter((slug) =>
    PRICING_ADDONS.some((a) => a.slug === slug),
  );

  const bracketTotalZAR = monthlyTotal(input.services, input.brackets, input.tierSlug, bracketRows);
  if (bracketTotalZAR <= 0) {
    return {
      ok: false,
      error: 'No priced services in your selection. Please pick at least one regular bracket.',
      status: 422,
    };
  }

  const monthlyTotalZAR = bracketTotalZAR + addonTotal(addonSlugs);
  // The configured price is the final, all-in monthly price. VAT is handled in
  // Xero (the billing pipeline), not on-site, so the site records no VAT split.
  const vatZAR = 0;
  const totalChargeZAR = monthlyTotalZAR;

  const serviceCatalogue = input.services.map((slug) => ({ slug, name: titleCase(slug) }));
  const lineItems = [
    ...buildLineItems(input.services, input.brackets, input.tierSlug, serviceCatalogue, bracketRows),
    ...buildAddonLineItems(addonSlugs),
  ];

  return {
    ok: true,
    data: { addonSlugs, lineItems, monthlyTotalZAR, vatZAR, totalChargeZAR },
  };
}
