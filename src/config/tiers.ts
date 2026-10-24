// Web-owned since 2026-10-07 (web-standalone phase 2).
//
// Package content follows the package simplification (2026-10-06): a
// bare-minimum baseline of five core services in every package, tiers defined
// by processing rhythm (Basic monthly, Pro weekly, Premium daily), Premium sold
// by application. Card lines from the Premium redesign, "more for better"
// (Zjak, 2026-10-24): titles only, the same order on every card, the cadence
// word first, and the cards grow from Basic to Premium. Direct Partner Access
// (2026-10-18) was removed from every surface the same day (Zjak).

export interface TierHighlightItem {
  text: string;
  services: string[];
  tooltip: string;
  calculatorOnly?: boolean;
  /**
   * Items in the same group replace each other as the package goes up (the
   * rhythm, the insights report). A cumulative list, such as the signed
   * schedule, keeps only the highest package's item of each group.
   */
  group?: 'rhythm' | 'reports';
  /** A card summary line ("Core services included"), not a schedule item. */
  summary?: boolean;
  /** The first word is the cadence ("Monthly", "Weekly"…), set in bold on the card. */
  cadence?: boolean;
  /** The signed schedule's wording where the contract must say more than the card line. */
  scheduleText?: string;
}

// Each card lists its package in full, starting with the core services and the
// processing rhythm (package simplification, 2026-10-06). Payroll is flat
// across packages, so its one line repeats on every card when payroll is chosen.
const CORE_SERVICES_INCLUDED: TierHighlightItem = {
  text: 'Core services included',
  services: ['accounting', 'bookkeeping'],
  tooltip: 'Everything in the core services: your year-round finance team, annual financials, your SARS and CIPC returns and your accounting software.',
  summary: true,
};

// The statutory basics only (decision 2026-10-06): no employee self-service
// portal or payment files on any package.
const PAYROLL_SERVICES: TierHighlightItem = {
  text: 'Payroll processing',
  services: ['payroll'],
  tooltip: 'Monthly payroll and payslips, with EMP201, EMP501, UIF and COIDA submissions handled on their cycles.',
  calculatorOnly: true,
};

// Its own line from Pro up, so it is clear Basic does not include it (Zjak,
// 2026-10-24).
const SUPPLIER_BILLS: TierHighlightItem = {
  text: 'Supplier bills captured and reconciled',
  services: ['bookkeeping'],
  tooltip: 'Supplier bills and receipts captured, matched to payments and checked against supplier statements.',
};

// A written report with an expert verdict, not a meeting (Zjak, 2026-10-24).
const INSIGHTS_TOOLTIP =
  "A written report on your key numbers, with our expert view of what's going well, what needs attention and what to do next.";

export const TIER_HIGHLIGHTS: Record<string, TierHighlightItem[]> = {
  basic: [
    CORE_SERVICES_INCLUDED,
    {
      text: 'Monthly processing',
      services: ['bookkeeping'],
      tooltip: 'Your bank is captured and reconciled once a month, at the monthly close.',
      group: 'rhythm',
      cadence: true,
    },
    {
      text: 'Quarterly insights report and business health check',
      services: ['accounting', 'bookkeeping'],
      tooltip: INSIGHTS_TOOLTIP,
      group: 'reports',
      cadence: true,
    },
    PAYROLL_SERVICES,
  ],
  pro: [
    CORE_SERVICES_INCLUDED,
    {
      text: 'Weekly processing',
      services: ['bookkeeping'],
      tooltip: 'We process what is available each week, so your books stay current between month-ends. Bank statements are still requested at every monthly close.',
      group: 'rhythm',
      cadence: true,
    },
    SUPPLIER_BILLS,
    {
      text: 'Monthly insights report and business health check',
      services: ['accounting', 'bookkeeping'],
      tooltip: INSIGHTS_TOOLTIP,
      group: 'reports',
      cadence: true,
    },
    PAYROLL_SERVICES,
  ],
  premium: [
    CORE_SERVICES_INCLUDED,
    {
      text: 'Daily processing',
      services: ['bookkeeping'],
      tooltip: 'We process what is available every business day, so your numbers are close to live.',
      group: 'rhythm',
      cadence: true,
    },
    SUPPLIER_BILLS,
    {
      text: 'Monthly insights report and business health check',
      services: ['accounting', 'bookkeeping'],
      tooltip: INSIGHTS_TOOLTIP,
      group: 'reports',
      cadence: true,
    },
    {
      text: 'Weekly KPI pulse',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'A short weekly note on the handful of numbers that matter most to your business, agreed with you at the start, and what to act on this week.',
      cadence: true,
    },
    {
      text: 'Cash-flow forecast and budget',
      services: ['accounting', 'bookkeeping'],
      tooltip: "An annual budget, and a 12-month cash-flow forecast updated every month, so you can see what's coming before it arrives.",
    },
    {
      text: 'Quarterly tax strategy',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'Each quarter, a sit-down with your partner on your tax position: provisional tax estimates, year-end planning and practical steps to pay no more tax than the law requires, timed around SARS deadlines.',
      cadence: true,
    },
    PAYROLL_SERVICES,
  ],
};

// Packages sold by application rather than self-serve acceptance. The
// calculator shows a "from" price and ends in a request (tweaks round 1);
// /api/proposals creates no proposal for them, and nothing else does either
// (staff proposal tools removed 2026-10-07, web-standalone phase 4).
export const TIERS_BY_APPLICATION: readonly string[] = ['premium'];

// Canonical display names for the three package slugs. The Supabase `tiers`
// table carries its own `name`, but the proposal PDF and emails are rendered
// without a DB read, so this is the single source for showing the chosen
// package by name there. Keep it in step with the `tiers.name` column.
export const TIER_DISPLAY_NAMES: Record<string, string> = {
  basic: 'Basic',
  pro: 'Pro',
  premium: 'Premium',
  'payroll-only': 'Payroll',
};

// Payroll on its own, without monthly accounting (Zjak, 2026-10-18). Stored as
// the proposal's tier_slug (plain text, no tiers row), so every surface shows
// it as the "Payroll" package. Priced at the payroll bracket's Basic price,
// the same flat figure payroll costs inside any package; no add-ons.
export const PAYROLL_ONLY_TIER = 'payroll-only';

/** The package slugs /api/proposals accepts. */
export const PROPOSAL_TIER_SLUGS: readonly string[] = ['basic', 'pro', 'premium', PAYROLL_ONLY_TIER];

/**
 * Human display name for a tier slug (e.g. `pro` → `Pro`), with a title-cased
 * fallback for any slug not in the map. Use wherever a proposal surface needs
 * to show the package by name rather than its slug.
 */
export function tierDisplayName(slug: string): string {
  return (
    TIER_DISPLAY_NAMES[slug] ??
    slug
      .split(/[-_]/)
      .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
      .join(' ')
  );
}

// The core services, included in every package. One list drives both the
// "Core services" rows in the /pricing comparison and the signed Schedule of
// Services (2026-10-13), so the site and the contract name the same things.
// `scheduleText` is the schedule's wording where the contract must say more
// than the row (the schedule shows names, not tooltips). `scheduleOnly` items
// are not comparison rows. `vatOnly` items apply only to a VAT-registered
// business.
export interface PackageCommonItem {
  text: string;
  tooltip: string;
  scheduleText?: string;
  scheduleOnly?: boolean;
  vatOnly?: boolean;
}

export const CORE_SERVICES: PackageCommonItem[] = [
  {
    text: 'Dedicated finance team',
    tooltip: 'A team that knows your business and runs your month, led by your own accountant.',
  },
  // The service level Zjak set on 2026-10-17 (service item register): the same
  // on every package. Premium's own support line must beat it.
  {
    text: 'Year-round support',
    scheduleText:
      'Year-round support (email to zjak@capucor.com, Monday to Friday 08:00 to 17:00, reply within 2 business days; calls by appointment)',
    tooltip:
      "Email zjak@capucor.com all year round. We work Monday to Friday, 08:00 to 17:00, and reply within 2 business days. If a question needs a conversation, we'll book a call. WhatsApp support is an add-on, included in Premium.",
  },
  {
    text: 'Annual financial statements',
    tooltip: 'Year-end financial statements prepared for compliance, SARS, banks and other stakeholders.',
  },
  // "SARS & CIPC submission" was Zjak's choice over "returns" (2026-10-13). On
  // the signed schedule it names the returns, so it never reads as "anything
  // SARS or CIPC"; audits, objections and change requests stay out of scope
  // (ALWAYS_OUT_OF_SCOPE in serviceScope.ts). VAT201 is its own item below.
  {
    text: 'SARS & CIPC submission',
    scheduleText:
      'SARS & CIPC submission (income tax and provisional tax returns, CIPC annual return and beneficial ownership filing)',
    tooltip: 'Your income tax and provisional tax returns, CIPC annual return and beneficial ownership filing, plus VAT returns if you are VAT-registered, each submitted on its cycle. SARS audits, objections and CIPC changes are quoted separately.',
  },
  { text: 'Xero accounting software', tooltip: 'Xero accounting software included in your monthly fee.' },
  // Named on the schedule so the signed scope stays explicit (package
  // simplification, 2026-10-06).
  {
    text: 'VAT returns (VAT201)',
    tooltip: 'VAT returns prepared and submitted for each applicable cycle.',
    scheduleOnly: true,
    vatOnly: true,
  },
];

/** The core services as rows under "Core services" in the comparison table. */
export const CORE_SERVICE_LINES: PackageCommonItem[] = CORE_SERVICES.filter((item) => !item.scheduleOnly);

/** The core items on the signed schedule, in schedule wording, hiding VAT201 when not VAT-registered. */
export function scheduleCommonItemsFor(vatRegistered: boolean): PackageCommonItem[] {
  return CORE_SERVICES.filter((item) => vatRegistered || !item.vatOnly).map((item) => ({
    ...item,
    text: item.scheduleText ?? item.text,
  }));
}

// Package slugs from lowest to highest. An add-on included "from" a tier is
// included in that tier and every tier after it.
export const TIER_ORDER: readonly string[] = ['basic', 'pro', 'premium'];

// Add-ons, flat monthly fees added on top of the bracket-based package price,
// unless the chosen package includes the add-on (includedFromTier), in which
// case it is carried at no charge. Server-side proposal pricing reads from this
// same list, so a slug here is the whitelist for /api/proposals and for
// re-pricing at signing.
//
// A proposal stores add-ons as a list of tokens in proposals.addons: the slug,
// or "slug:count" for a per-unit add-on (e.g. "personal-tax:3"). See
// parseAddonToken in lib/pricing.ts.
export interface PricingAddon {
  slug: string;
  name: string;
  /** Monthly price; per unit for a per-unit add-on. */
  priceZAR: number;
  description: string;
  includedFromTier?: string;
  /** Not offered as a choice on the add-ons step; set from a calculator answer. */
  hidden?: boolean;
  /** Priced per unit per month; the stored token carries the count. */
  unit?: { singular: string; plural: string; max: number };
  /** Charged inside this service's line rather than as its own line. */
  foldIntoService?: string;
  /** A zero-price scope marker that travels with the proposal; never a line. */
  scopeFlag?: boolean;
  /** Line label when the package charges for it (e.g. Dext on Basic). */
  chargedLabel?: string;
}

/** True when the package includes this add-on at no charge. */
export function addonIncludedInTier(addon: PricingAddon, tierSlug: string): boolean {
  if (!addon.includedFromTier) return false;
  const from = TIER_ORDER.indexOf(addon.includedFromTier);
  const at = TIER_ORDER.indexOf(tierSlug);
  return from >= 0 && at >= from;
}

export const PRICING_ADDONS: PricingAddon[] = [
  {
    slug: 'dext',
    name: 'Dext with AI Assist',
    priceZAR: 375,
    description:
      'Snap receipts and invoices with the Dext app, AI Assist included, and they flow straight into your books.',
    includedFromTier: 'pro',
    // Basic has no supplier processing, so on Basic the client does the processing.
    chargedLabel: 'Software access, you process the items',
    // WITHDRAWN 2026-10-06 (tweaks round 1): no longer offered on Basic and not
    // mentioned anywhere; Capucor still delivers Dext on Pro and Premium. Kept
    // so proposals already sent with the token price and render as sent.
    hidden: true,
  },
  {
    slug: 'whatsapp-support',
    name: 'WhatsApp Support',
    priceZAR: 750,
    description: 'A dedicated WhatsApp channel to your accountant and team for simpler questions and support.',
    // Included in Premium at no charge (Zjak, 2026-10-18; kept as a Premium
    // inclusion in its own right when Direct Partner Access went, 2026-10-24).
    includedFromTier: 'premium',
  },
  {
    slug: 'category-tracking',
    name: 'Category Tracking',
    priceZAR: 1200,
    description:
      'Tracking categories set up for your branches, projects or departments, with every transaction coded to them so your reports split by category.',
  },
  {
    slug: 'personal-tax',
    name: 'Personal Tax Returns',
    priceZAR: 75,
    description:
      'Annual income tax returns (ITR12) prepared and filed for selected individuals.',
    unit: { singular: 'person', plural: 'people', max: 10 },
  },
  // RETIRED 2026-10-06 (calculator review answers): the Xero-invoicing question
  // and the R 200 Basic charge are withdrawn. Nothing offers or derives this
  // token any more, and /api/proposals strips it. It stays here, unchanged, so
  // proposals already sent with it still price and render exactly as signed
  // (signing and the PDF re-price from the stored tokens).
  {
    slug: 'xero-invoicing',
    name: 'Xero Plan with Customer Invoicing',
    priceZAR: 200,
    description: 'A Xero plan that supports customer invoicing and payment tracking. Included from Pro.',
    includedFromTier: 'pro',
    hidden: true,
    foldIntoService: 'accounting',
  },
  {
    slug: 'not-vat-registered',
    name: 'Not VAT-registered',
    priceZAR: 0,
    description: 'The business is not registered for VAT, so VAT201 returns are not part of the schedule.',
    hidden: true,
    scopeFlag: true,
  },
];

// The line under each package name: what it gets (the Steady / Growing /
// Fast-moving pills went on 2026-10-13, Zjak). No monthly, weekly or
// daily here; the rhythm lives in the item lists (Zjak, calculator design
// review, 2026-10-13). "Reviews" read as meetings, so the wording changed with
// the Premium redesign (2026-10-24). Basic still reads as complete: every package carries the
// core services.
export const TIER_BUYER_FIT: Record<string, string> = {
  basic: 'Essentials done properly, with regular check-ins on where the business stands and what to do next.',
  pro: "Current numbers, suppliers handled and a closer eye every month, so growth doesn't outrun the books.",
  premium: "Know where you stand every week, see what's coming, and plan ahead for tax with your partner.",
};
