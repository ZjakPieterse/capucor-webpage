import { createSupabaseAnonClient } from '@/lib/supabase/anon';
import type { PricingData, Testimonial } from '@/types';

// Pricing-config fetch for the public /pricing calculator and the homepage
// packages teaser. The config (services/brackets/tiers) is always read as the
// `anon` role — a session-bound client returns zero rows for signed-in visitors
// because these tables only grant `select to anon` (see anon.ts / AGENTS.md).
// Keep this the single source so every public surface stays in lockstep.
//
// capucor-os has its own leaner equivalent for the staff amend form (Phase 1b);
// the anon-client rule is the part that must hold in both.

export type PricingResult = {
  pricing: PricingData;
  testimonials: Testimonial[];
};

const PRICING_FETCH_ATTEMPTS = 3;
const PRICING_RETRY_BASE_DELAY_MS = 250;

// One fetch attempt. Throws on a query error OR an empty essential table so the
// caller's retry loop can treat both as transient and try again.
async function fetchPricingDataOnce(): Promise<PricingResult> {
  // Public pricing config is read as the `anon` role regardless of whether the
  // visitor is signed in — see anon.ts for why a session-bound client breaks it.
  const supabase = createSupabaseAnonClient();

  const [servicesRes, bracketsRes, tiersRes, testimonialsRes] =
    await Promise.all([
      supabase
        .from('services')
        .select('*')
        .eq('active', true)
        .order('display_order'),
      supabase
        .from('brackets')
        .select('*')
        .eq('active', true)
        .order('display_order'),
      supabase
        .from('tiers')
        .select('*')
        .eq('active', true)
        .order('display_order'),
      supabase
        .from('testimonials')
        .select('*')
        .eq('active', true)
        .order('display_order'),
    ]);

    if (servicesRes.error || bracketsRes.error || tiersRes.error) {
      throw new Error('Supabase query error');
    }

  const rawTestimonials = (testimonialsRes.data ?? []) as Testimonial[];
  // Filter out seed placeholders like "[Client Name]"
  const testimonials = rawTestimonials.filter(
    (t) => !t.name.startsWith('[') && !t.quote.startsWith('[')
  );

  const pricing: PricingData = {
    services: (servicesRes.data ?? []) as PricingData['services'],
    brackets: (bracketsRes.data ?? []) as PricingData['brackets'],
    tiers: (tiersRes.data ?? []) as PricingData['tiers'],
  };

  // A successful query can still come back empty (e.g. a transient Supabase
  // cold-start). The calculator can't function without these three essential
  // tables — treat empty as a retryable failure rather than rendering a dead
  // step 1 with no options to select.
  if (
    pricing.services.length === 0 ||
    pricing.brackets.length === 0 ||
    pricing.tiers.length === 0
  ) {
    throw new Error(
      `empty pricing data (services=${pricing.services.length} brackets=${pricing.brackets.length} tiers=${pricing.tiers.length})`
    );
  }

  return { pricing, testimonials };
}

// Retry the fetch a few times before giving up. A single transient blip on any
// of the parallel queries used to take the whole calculator down with no second
// chance; each attempt gets a fresh Supabase client so a stale connection can
// recover. Only after every attempt fails do we return null.
export async function getPricingData(): Promise<PricingResult | null> {
  for (let attempt = 1; attempt <= PRICING_FETCH_ATTEMPTS; attempt++) {
    try {
      return await fetchPricingDataOnce();
    } catch (err) {
      console.error(
        `[pricing] fetch attempt ${attempt}/${PRICING_FETCH_ATTEMPTS} failed`,
        err
      );
      if (attempt < PRICING_FETCH_ATTEMPTS) {
        // Jitter so concurrent requests retrying through the same Supabase
        // blip don't hit it again in synchronized waves.
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            PRICING_RETRY_BASE_DELAY_MS * attempt + Math.random() * 100
          )
        );
      }
    }
  }
  return null;
}
