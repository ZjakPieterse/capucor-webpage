// 'not_required' is the explicit opt-out a visitor picks in the calculator's
// scope step for a service they don't need. Pricing math only ever counts
// numeric values, so it (like 'enterprise') never contributes to a total.
export type BracketValue = number | 'enterprise' | 'not_required';

export interface Service {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  bracket_unit_label: string;
  display_order: number;
  active: boolean;
  created_at: string;
}

export interface Bracket {
  id: string;
  service_slug: string;
  ordinal: number;
  label: string;
  is_enterprise: boolean;
  display_order: number;
  active: boolean;
  basic_price: number;
  pro_price: number;
  premium_price: number;
}

export interface Tier {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  multiplier: number;
  display_order: number;
  active: boolean;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string | null;
  business: string | null;
  quote: string;
  avatar_url: string | null;
  display_order: number;
  active: boolean;
  created_at: string;
}

export interface PricingData {
  services: Service[];
  brackets: Bracket[];
  tiers: Tier[];
}

// The calculator has two real input steps (Business scope → Package). The 3rd
// stepper segment is a completion marker ("Done"), not an input step.
export type CalculatorStep = 1 | 2;

export interface PricingState {
  step: CalculatorStep;
  // Derived from selectedBrackets: slugs whose bracket is numeric. Kept in
  // state so every consumer (tiers step, totals, proposal payload) reads one
  // shape; setBracket maintains it.
  selectedServices: Set<string>;
  selectedBrackets: Record<string, BracketValue>;
  selectedTier: string | null;
  // Optional flat-fee add-ons (PRICING_ADDONS slugs), chosen in the package step.
  selectedAddons: string[];
}

// ── Subscription / activation ────────────────────────────────────────────
export interface BusinessDetails {
  legalName: string;
  cipcNumber?: string;
  vatNumber?: string;
  sector: string;
}

export type SubscriptionStatus =
  | 'pending_payment'
  | 'active'
  | 'cancelling'      // notice given, still active until end_at
  | 'cancelled'
  | 'past_due';

export interface SubscriptionSummary {
  id: string;
  status: SubscriptionStatus;
  tierSlug: string;
  tierName: string;
  monthlyTotalZAR: number;       // final all-in monthly price (services + add-ons)
  vatZAR: number;                // always 0 — VAT handled in Xero, not on-site
  totalChargeZAR: number;        // equals monthlyTotalZAR
  services: string[];            // slugs
  brackets: Record<string, BracketValue>;
  nextBillingDate: string | null;   // ISO date
  endAt: string | null;             // ISO date when cancelling/cancelled
  createdAt: string;                // ISO datetime
}

export interface SubscriptionRequestPayload {
  // Calculator config
  services: string[];
  brackets: Record<string, number>;   // never enterprise in self-serve flow
  tierSlug: string;
  // Account + business
  email: string;
  fullName: string;
  business: BusinessDetails;
  consentGiven: true;
  // Honeypot
  website?: string;
}

export interface LeadPayload {
  source:
    | 'signup'
    | 'quote'
    | 'enterprise'
    | 'contact'
    | 'call'
    | 'proposal'
    | 'roi'
    | 'lead_magnet';
  name: string;
  email: string;
  business?: string;
  phone?: string;
  message?: string;
  config?: Record<string, unknown>;
  consent_given: true;
  website?: string;
}
