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
      text: 'Xero Software Included',
      services: ['bookkeeping'],
      tooltip: 'Xero accounting software included as part of your monthly subscription.',
    },
    {
      text: 'Bookkeeping & Monthly Close',
      services: ['bookkeeping'],
      tooltip: 'Transactions processed, reconciled, and closed off through a structured monthly workflow.',
    },
    {
      text: 'Monthly Financial Reports',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'Receive regular financial reports to stay informed about business performance.',
    },
    {
      text: 'Payroll Processing & Payslips',
      services: ['payroll'],
      tooltip: 'Monthly payroll calculations and employee payslips prepared accurately and on time.',
      calculatorOnly: true,
    },
    {
      text: 'EMP201 & EMP501 Submissions',
      services: ['payroll'],
      tooltip: 'Monthly and bi-annual employer payroll submissions prepared and lodged as required.',
      calculatorOnly: true,
    },
    {
      text: 'UIF Declarations & Termination Forms',
      services: ['payroll'],
      tooltip: 'UIF declarations submitted and relevant termination documents made available when needed.',
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
      text: 'Quarterly Performance Review',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'A structured quarterly review to discuss performance, key concerns, and areas requiring attention.',
    },
    {
      text: 'Supplier Processing with Dext',
      services: ['bookkeeping'],
      tooltip: 'Supplier invoices processed through Dext to improve recordkeeping and supplier-balance visibility.',
    },
    {
      text: 'Core Business Metrics Overview',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'View selected business metrics for a clearer snapshot of financial performance.',
    },
    {
      text: 'Monthly 5-Min Video Walkthrough',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'Receive a short monthly video highlighting the key points from your latest financial results.',
    },
    {
      text: 'Employee Self-Service Portal',
      services: ['payroll'],
      tooltip: 'Employees can access payslips and tax certificates directly through a secure self-service portal.',
      calculatorOnly: true,
    },
    {
      text: 'Leave Management & Approvals',
      services: ['payroll'],
      tooltip: 'Employees submit leave digitally and managers approve requests through a structured workflow.',
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
      text: 'Budget vs Actual Review',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'Compare actual financial performance against budget and identify areas requiring attention.',
    },
    {
      text: 'Advanced KPI Dashboard',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'Access a broader KPI dashboard with deeper financial and operational performance insights.',
    },
    {
      text: 'Rolling Cashflow Forecast',
      services: ['accounting', 'bookkeeping'],
      tooltip: 'Maintain a forward-looking view of expected cash inflows, outflows, and potential pressure points.',
    },
    {
      text: 'Payroll Payment File Preparation',
      services: ['payroll'],
      tooltip: 'A bank-upload salary-payment file is prepared after payroll finalisation to simplify the payment process.',
      calculatorOnly: true,
    },
    {
      text: 'Direct Employee Payroll Support',
      services: ['payroll'],
      tooltip: 'Employees receive direct assistance with defined payroll-related queries, reducing routine admin for management.',
      calculatorOnly: true,
    },
  ],
};

export const TIER_CUMULATIVE_LABELS: Record<string, string> = {
  pro: 'Everything in Basic, plus:',
  premium: 'Everything in Pro, plus:',
};

export const PACKAGE_COMMON_ITEMS = [
  { text: 'Dedicated Finance Team', tooltip: 'A named team that knows your business.' },
  { text: 'SARS & CIPC Compliance', tooltip: 'Tax returns and annual filings done each year. Nothing to remember.' },
  { text: 'Year-round Advisory', tooltip: 'Ongoing guidance from your accountant — not just at year-end.' },
];

export const TIER_BUYER_FIT: Record<string, string> = {
  basic: 'For businesses that need the essentials done properly.',
  pro: 'For businesses that want monthly visibility and a more active finance rhythm.',
  premium: 'For businesses that want closer advisory, live KPIs and deeper monthly planning.',
};
