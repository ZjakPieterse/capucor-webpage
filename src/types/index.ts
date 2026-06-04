export type BracketValue = number | 'enterprise';

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

export interface TierInclusion {
  id: string;
  tier_slug: string;
  service_slug: string;
  inclusion: string;
  display_order: number;
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
  inclusions: TierInclusion[];
}

// The calculator has three real input steps (Services → Business → Package).
// The 4th stepper segment is a completion marker ("Done"), not an input step.
export type CalculatorStep = 1 | 2 | 3;

export interface PricingState {
  step: CalculatorStep;
  selectedServices: Set<string>;
  selectedBrackets: Record<string, BracketValue>;
  selectedTier: string | null;
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
  monthlyTotalZAR: number;       // excl. VAT
  vatZAR: number;                // 15%
  totalChargeZAR: number;        // incl. VAT
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
