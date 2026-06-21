export interface TierHighlightItem {
  text: string;
  services: string[];
  tooltip: string;
  calculatorOnly?: boolean;
}

export const TIER_HIGHLIGHTS: Record<string, TierHighlightItem[]> = {
  basic: [
    {
      text: 'Annual Financial Statements',
      services: ['accounting'],
      tooltip: 'Year-end financial statements prepared for compliance, SARS, banks, and other stakeholders.',
    },
    {
      text: 'SARS & CIPC Compliance',
      services: ['accounting'],
      tooltip: 'Annual tax and company-compliance requirements handled for you.',
    },
    {
      text: 'VAT Reporting & Submission',
      services: ['accounting'],
      tooltip: 'VAT returns prepared and submitted accurately for each applicable cycle.',
    },
    {
      text: 'Bookkeeping & Monthly Close',
      services: ['bookkeeping'],
      tooltip: 'Transactions processed, reconciled, and closed off through a structured monthly workflow.',
    },
    {
      text: 'Core Monthly Financials',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'Receive regular financial reports to stay informed about business performance.',
    },
    {
      text: 'Payroll Processing & Payslips',
      services: ['payroll'],
      tooltip: 'Monthly payroll calculations and employee payslips prepared accurately and on time, with EMP201 and EMP501 submissions lodged on their cycles and UIF declarations handled when needed.',
      calculatorOnly: true,
    },
    {
      text: 'COIDA Annual Submission',
      services: ['payroll'],
      tooltip: 'Annual COIDA Return of Earnings information prepared and submitted for compliance purposes.',
      calculatorOnly: true,
    },
  ],
  pro: [
    {
      text: 'Quarterly Review Meeting',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'A structured quarterly review to discuss performance, key concerns, and areas requiring attention.',
    },
    {
      text: 'Accounts Payable Management',
      services: ['bookkeeping'],
      tooltip: 'Supplier invoices captured and processed, keeping supplier balances accurate and easy to track.',
    },
    {
      text: 'Monthly Insights Report',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'A monthly report covering selected business metrics for a clearer snapshot of financial performance.',
    },
    {
      text: 'Monthly 5-Min Video Explainer',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'Receive a short monthly video highlighting the key points from your latest financial results.',
    },
    {
      text: 'Employee Self-Service Portal',
      services: ['payroll'],
      tooltip: 'Employees can access payslips and tax certificates directly through a secure self-service portal.',
      calculatorOnly: true,
    },
  ],
  premium: [
    {
      text: 'Monthly Strategy Session',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'A monthly discussion focused on performance, financial priorities, and practical next steps.',
    },
    {
      text: 'Budget vs Actual Reporting',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'Compare actual financial performance against budget and identify areas requiring attention.',
    },
    {
      text: 'Advanced KPI Dashboard',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'Access a broader KPI dashboard with deeper financial and operational performance insights.',
    },
    {
      text: 'Benchmark Analysis',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'See how your key numbers compare against similar businesses, showing where you lead and where there is room to improve.',
    },
    {
      text: 'Payroll Payment Files Prepared',
      services: ['payroll'],
      tooltip: 'A bank-upload salary-payment file is prepared after payroll finalisation to simplify the payment process.',
      calculatorOnly: true,
    },
  ],
};

export const TIER_CUMULATIVE_LABELS: Record<string, string> = {
  basic: 'Your compliance foundation:',
  pro: 'Everything in Basic, plus:',
  premium: 'Everything in Pro, plus:',
};

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

export const PACKAGE_COMMON_ITEMS = [
  { text: 'Dedicated Finance Team', tooltip: 'A named team that knows your business.' },
  { text: 'SARS & CIPC Compliance', tooltip: 'Tax returns and annual filings done each year. Nothing to remember.' },
  { text: 'Xero Software Included', tooltip: 'Xero accounting software included as part of your monthly subscription.' },
  { text: 'Year-round Support', tooltip: 'Ongoing guidance from your accountant — not just at year-end.' },
];

// Optional add-ons available with every package in the pricing calculator.
// Flat monthly fees added on top of the bracket-based tier price.
// Server-side proposal pricing reads from this same list, so a slug here is
// the whitelist for /api/proposals.
export interface PricingAddon {
  slug: string;
  name: string;
  priceZAR: number;
  description: string;
}

export const PRICING_ADDONS: PricingAddon[] = [
  {
    slug: 'dext',
    name: 'Dext Software Access',
    priceZAR: 375,
    description:
      'Snap receipts and invoices with the Dext app and they flow straight into your books.',
  },
];

export const TIER_BUYER_FIT: Record<string, string> = {
  basic: 'For businesses that need the essentials done properly.',
  pro: 'For businesses that want monthly visibility and a more active finance rhythm.',
  premium: 'For businesses that want closer advisory, live KPIs and deeper monthly planning.',
};
