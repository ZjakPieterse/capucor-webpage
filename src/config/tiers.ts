// Web-owned since 2026-10-07 (web-standalone phase 2).
//
// Package content follows the package simplification (2026-10-06): a
// bare-minimum baseline of five core services in every package, tiers defined
// by processing rhythm (Basic monthly, Pro weekly, Premium daily), Premium sold
// by application.

export interface TierHighlightItem {
  text: string;
  services: string[];
  tooltip: string;
  calculatorOnly?: boolean;
  /**
   * Items in the same group replace each other as the package goes up (the
   * rhythm, the reports, the review). A cumulative list, such as the signed
   * schedule, keeps only the highest package's item of each group.
   */
  group?: 'rhythm' | 'reports' | 'review';
  /** A card summary line ("Core Services Included"), not a schedule item. */
  summary?: boolean;
}

// Each card lists its package in full, starting with the core services and the
// processing rhythm (package simplification, 2026-10-06). Payroll is flat
// across packages, so its one line repeats on every card when payroll is chosen.
const CORE_SERVICES_INCLUDED: TierHighlightItem = {
  text: 'Core Services Included',
  services: ['accounting', 'bookkeeping'],
  tooltip: 'Everything in the core services: a dedicated finance team, annual financials, SARS and CIPC submissions, your accounting software and year-round support.',
  summary: true,
};

// The statutory basics only (decision 2026-10-06): no employee self-service
// portal or payment files on any package.
const PAYROLL_SERVICES: TierHighlightItem = {
  text: 'Payroll Services',
  services: ['payroll'],
  tooltip: 'Monthly payroll and payslips, with EMP201, EMP501, UIF and COIDA submissions handled on their cycles.',
  calculatorOnly: true,
};

const SUPPLIER_PROCESSING: TierHighlightItem = {
  text: 'Supplier Processing & Review',
  services: ['bookkeeping'],
  tooltip: 'Supplier bills captured and reviewed, so what you owe suppliers and what customers owe you is always up to date.',
};

export const TIER_HIGHLIGHTS: Record<string, TierHighlightItem[]> = {
  basic: [
    CORE_SERVICES_INCLUDED,
    {
      text: 'Monthly Processing',
      services: ['bookkeeping'],
      tooltip: 'Your transactions are processed and reconciled once a month, at the monthly close.',
      group: 'rhythm',
    },
    {
      text: 'Quarterly Insights Report',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'A report every quarter with the key numbers and what they mean for the business.',
      group: 'reports',
    },
    {
      text: 'Quarterly Performance Review',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'A review every quarter of how the business is performing and what needs attention.',
      group: 'review',
    },
    PAYROLL_SERVICES,
  ],
  pro: [
    CORE_SERVICES_INCLUDED,
    {
      text: 'Weekly Processing',
      services: ['bookkeeping'],
      tooltip: 'We process what is available each week, so your books stay current between month-ends. Bank statements are still requested at every monthly close.',
      group: 'rhythm',
    },
    {
      text: 'Monthly Insights Report',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'A report every month with the key numbers and what they mean for the business.',
      group: 'reports',
    },
    {
      text: 'Monthly Performance Review',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'A review every month covering performance, key concerns and next steps.',
      group: 'review',
    },
    SUPPLIER_PROCESSING,
    PAYROLL_SERVICES,
  ],
  premium: [
    CORE_SERVICES_INCLUDED,
    {
      text: 'Daily Processing',
      services: ['bookkeeping'],
      tooltip: 'We process what is available every business day, so your numbers are close to live.',
      group: 'rhythm',
    },
    {
      text: 'Weekly Insights Report',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'A report every week with the key numbers, so decisions are made on current figures.',
      group: 'reports',
    },
    {
      text: 'Weekly Performance Review',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'A short review every week covering performance, key concerns and next steps.',
      group: 'review',
    },
    SUPPLIER_PROCESSING,
    {
      text: 'Monthly Tax Strategy & Planning',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'A monthly planning cycle covering your tax position, cash flow and the decisions ahead.',
    },
    {
      text: 'On-call Partner Support',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'A direct line to your partner, with a reply the same business day.',
    },
    PAYROLL_SERVICES,
  ],
};

// Packages sold by application rather than self-serve acceptance. The
// calculator shows a "from" price and ends in a request (tweaks round 1);
// /api/proposals creates no proposal for them. Staff can still prepare and
// amend a proposal on capucor.app.
export const TIERS_BY_APPLICATION: readonly string[] = ['premium'];

// Canonical display names for the three package slugs. The Supabase `tiers`
// table carries its own `name`, but the proposal PDF and emails are rendered
// without a DB read, so this is the single source for showing the chosen
// package by name there. Keep it in step with the `tiers.name` column.
export const TIER_DISPLAY_NAMES: Record<string, string> = {
  basic: 'Basic',
  pro: 'Pro',
  premium: 'Premium',
};

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

// The core services, included in every package and shown above the cards.
// `vatOnly` items apply only to a VAT-registered business; `scheduleOnly` items
// are spelled out on the signed schedule but not shown on the site.
export interface PackageCommonItem {
  text: string;
  tooltip: string;
  vatOnly?: boolean;
  scheduleOnly?: boolean;
}

export const PACKAGE_COMMON_ITEMS: PackageCommonItem[] = [
  { text: 'Dedicated Finance Team', tooltip: 'A team that knows your business and runs your month, led by your own accountant.' },
  {
    text: 'Annual Financials',
    tooltip: 'Year-end financial statements prepared for compliance, SARS, banks and other stakeholders.',
  },
  {
    text: 'SARS & CIPC Submission',
    tooltip: 'Tax returns and annual CIPC filings submitted on time, including VAT returns if you are VAT-registered.',
  },
  { text: 'Xero Accounting Software', tooltip: 'Xero accounting software included in your monthly fee.' },
  { text: 'Year-round Support', tooltip: 'Ongoing guidance from your team all year, not only at year-end.' },
  // Part of "SARS & CIPC Submission" on the site; named on the schedule so the
  // signed scope stays explicit (package simplification, 2026-10-06).
  {
    text: 'VAT returns (VAT201)',
    tooltip: 'VAT returns prepared and submitted for each applicable cycle.',
    vatOnly: true,
    scheduleOnly: true,
  },
];

/** The core items shown on the site, for every package. */
export function packageCommonItemsFor(vatRegistered: boolean): PackageCommonItem[] {
  return PACKAGE_COMMON_ITEMS.filter((item) => !item.scheduleOnly && (vatRegistered || !item.vatOnly));
}

/** The core items on the signed schedule, hiding VAT201 when not VAT-registered. */
export function scheduleCommonItemsFor(vatRegistered: boolean): PackageCommonItem[] {
  return PACKAGE_COMMON_ITEMS.filter((item) => vatRegistered || !item.vatOnly);
}

// Package slugs from lowest to highest. An add-on included "from" a tier is
// included in that tier and every tier after it.
export const TIER_ORDER: readonly string[] = ['basic', 'pro', 'premium'];

// Add-ons, flat monthly fees added on top of the bracket-based package price,
// unless the chosen package includes the add-on (includedFromTier), in which
// case it is carried at no charge. Server-side proposal pricing reads from this
// same list, so a slug here is the whitelist for /api/proposals and the staff
// amend form.
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
    name: 'WhatsApp Support Channel',
    priceZAR: 750,
    description: 'A dedicated WhatsApp channel to your accountant for quick questions and document requests.',
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
      'An annual personal income tax return (ITR12) prepared and submitted for each person.',
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

export const TIER_BUYER_FIT: Record<string, string> = {
  basic: 'For businesses that want the essentials done properly, once a month.',
  pro: 'For businesses that want their books current every week and a monthly review.',
  premium: 'For businesses that want daily processing, weekly reporting and a partner on call.',
};
