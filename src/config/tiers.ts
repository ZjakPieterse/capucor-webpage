// ⚠️ HAND-SYNCED with capucor-os/src/config/tiers.ts and pinned by digest in
// contracts/cross-repo-contract.json. Change both copies together.
//
// Package content follows the calculator-v2 decisions (2026-10-06): one core
// service in every package, tiers defined by processing rhythm (Basic monthly,
// Pro weekly, Premium daily), Premium sold by booking a call.

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
// processing rhythm (tweaks round 1, 2026-10-06). Premium does not repeat Pro's
// extras; the comparison table and the schedule carry them cumulatively.
// Payroll is flat across packages, so its lines repeat on every card.
const CORE_SERVICES_INCLUDED: TierHighlightItem = {
  text: 'Core Services Included',
  services: ['accounting', 'bookkeeping'],
  tooltip: 'Everything in the core services: your own accountant, SARS and CIPC compliance, annual financial statements, bookkeeping and the monthly close, and year-round support.',
  summary: true,
};

const PAYROLL_PROCESSING: TierHighlightItem = {
  text: 'Payroll Processing & Payslips',
  services: ['payroll'],
  tooltip: 'Monthly payroll calculations and employee payslips prepared accurately and on time, with EMP201 and EMP501 submissions lodged on their cycles and UIF declarations handled when needed.',
  calculatorOnly: true,
};

const COIDA_SUBMISSION: TierHighlightItem = {
  text: 'COIDA Annual Submission',
  services: ['payroll'],
  tooltip: 'Annual COIDA Return of Earnings information prepared and submitted for compliance purposes.',
  calculatorOnly: true,
};

const EMPLOYEE_PORTAL: TierHighlightItem = {
  text: 'Employee Self-Service Portal',
  services: ['payroll'],
  tooltip: 'Employees can access payslips and tax certificates directly through a secure self-service portal.',
  calculatorOnly: true,
};

export const TIER_HIGHLIGHTS: Record<string, TierHighlightItem[]> = {
  basic: [
    CORE_SERVICES_INCLUDED,
    {
      text: 'Processing Rhythm: Monthly',
      services: ['bookkeeping'],
      tooltip: 'Your bank transactions are processed and reconciled once a month, at the monthly close.',
      group: 'rhythm',
    },
    {
      text: 'Monthly Basic Reports',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'A profit and loss statement and balance sheet after each monthly close.',
      group: 'reports',
    },
    {
      text: 'Quarterly Performance Review',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'A review every quarter of how the business is performing and what needs attention.',
      group: 'review',
    },
    PAYROLL_PROCESSING,
    COIDA_SUBMISSION,
  ],
  pro: [
    CORE_SERVICES_INCLUDED,
    {
      text: 'Processing Rhythm: Weekly',
      services: ['bookkeeping'],
      tooltip: 'We process what is available each week, so your books stay current between month-ends. Bank statements are still requested at every monthly close.',
      group: 'rhythm',
    },
    {
      text: 'Monthly Insights Report',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'A monthly report covering selected business metrics for a clearer snapshot of financial performance.',
      group: 'reports',
    },
    {
      text: 'Monthly Performance Review',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'A review every month, in place of the quarterly review, covering performance, key concerns and next steps.',
      group: 'review',
    },
    {
      text: 'Monthly 5-Minute Video Explainer',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'Receive a short monthly video highlighting the key points from your latest financial results.',
    },
    {
      text: 'Supplier Processing & Review',
      services: ['bookkeeping'],
      tooltip: 'Supplier bills captured and reviewed, so what you owe suppliers and what customers owe you is always up to date.',
    },
    PAYROLL_PROCESSING,
    COIDA_SUBMISSION,
    EMPLOYEE_PORTAL,
  ],
  premium: [
    CORE_SERVICES_INCLUDED,
    {
      text: 'Processing Rhythm: Daily',
      services: ['bookkeeping'],
      tooltip: 'We process what is available every business day, so your numbers are close to live.',
      group: 'rhythm',
    },
    {
      text: 'Weekly Reports & Review',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'A short report and review every week, so decisions are made on current numbers.',
      group: 'review',
    },
    {
      text: 'Monthly Tax & Financial Planning',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'A monthly planning cycle covering tax position, cash flow and the decisions ahead.',
    },
    {
      text: 'Budget vs Actual Reporting',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'Compare actual financial performance against budget and identify areas requiring attention.',
    },
    {
      text: 'On-Call Partner Support',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'A direct line to your partner, with a reply the same business day.',
    },
    PAYROLL_PROCESSING,
    COIDA_SUBMISSION,
    EMPLOYEE_PORTAL,
    {
      text: 'Payroll Payment Files Prepared',
      services: ['payroll'],
      tooltip: 'A bank-upload salary-payment file is prepared after payroll finalisation to simplify the payment process.',
      calculatorOnly: true,
    },
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
// `vatOnly` items show only for a VAT-registered business.
export interface PackageCommonItem {
  text: string;
  tooltip: string;
  vatOnly?: boolean;
}

export const PACKAGE_COMMON_ITEMS: PackageCommonItem[] = [
  { text: 'Your own accountant', tooltip: 'One accountant who knows your business and runs your month.' },
  { text: 'Xero software included', tooltip: 'Xero accounting software included as part of your monthly subscription.' },
  { text: 'SARS & CIPC compliance', tooltip: 'Tax returns and annual filings done each year. Nothing to remember.' },
  {
    text: 'Annual financial statements',
    tooltip: 'Year-end financial statements prepared for compliance, SARS, banks, and other stakeholders.',
  },
  {
    text: 'VAT returns (VAT201)',
    tooltip: 'VAT returns prepared and submitted accurately for each applicable cycle.',
    vatOnly: true,
  },
  {
    text: 'Bookkeeping & monthly close',
    tooltip: 'Transactions reconciled and closed off every month. Bank statements are requested at every monthly close.',
  },
  { text: 'Year-round support', tooltip: 'Ongoing guidance from your accountant all year, not only at year-end.' },
];

/** The core items for a business, hiding VAT201 when it is not VAT-registered. */
export function packageCommonItemsFor(vatRegistered: boolean): PackageCommonItem[] {
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
      'An annual personal income tax return (ITR12) prepared and submitted for each person: R 900.00 a year per person, billed monthly.',
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
