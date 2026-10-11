/**
 * The three disciplines, as the homepage services cards and the service pages
 * tell them. One source, so a card's four items are always the same four
 * cards under that page's "What's included" (Zjak, 2026-10-11).
 *
 * Each item says what we do (`description`) and what that means for the owner
 * (`covered`). Item names follow the packages (config/tiers.ts). Keep
 * deadlines conditional on the client's information, and promise no package
 * frequency except where it is stated per package.
 */

export interface ServiceItem {
  title: string;
  description: string;
  covered: string;
}

export interface ServicePage {
  slug: 'accounting' | 'bookkeeping' | 'payroll';
  title: string;
  href: string;
  /** Short tagline under the card title. */
  hook: string;
  /** Two sentences on what it means for the owner. */
  body: string;
  items: ServiceItem[];
}

export const ACCOUNTING: ServicePage = {
  slug: 'accounting',
  title: 'Accounting',
  href: '/accounting',
  hook: 'Compliance, covered.',
  body: "Your tax and filings are done before anyone asks, so you know what's due before it lands. When the bank wants financials, they're ready.",
  items: [
    {
      title: 'Annual financial statements',
      description:
        'Compiled each year by a professional accountant from the books we keep, and checked before they reach you. Ready for SARS, your bank, a funder or a buyer.',
      covered: "When someone asks for your financials, they're ready to send.",
    },
    {
      title: 'Income and provisional tax',
      description:
        "Your company's income tax return prepared and filed, and provisional tax calculated and submitted for the August and February cycles, when we have your information in time.",
      covered: "You know roughly what's due before it's due, so there's time to plan for it.",
    },
    {
      title: "VAT201 returns, if you're registered",
      description:
        'Your VAT return prepared and submitted every cycle, monthly or every two months depending on your registration, with input and output VAT reconciled before it goes in.',
      covered: 'VAT stops being a recurring scramble, and the amount to pay is no surprise.',
    },
    {
      title: 'CIPC annual returns',
      description:
        "Your company's annual return filed with CIPC each year, with your company details kept up to date.",
      covered: 'Your company stays in good standing, with no deregistration risk from a missed return.',
    },
  ],
};

export const BOOKKEEPING: ServicePage = {
  slug: 'bookkeeping',
  title: 'Bookkeeping',
  href: '/bookkeeping',
  hook: 'Know where you really stand.',
  body: 'You decide from real numbers, not your bank balance. Each report comes with an accountant who tells you what changed and what to do next.',
  items: [
    {
      title: 'Xero accounting software included',
      description:
        'Your Xero subscription is part of your fee, set up for your business with your bank feeds connected. You keep your own login.',
      covered: 'No separate software bill, and you can see your numbers any time.',
    },
    {
      title: 'Transactions processed and coded',
      description:
        'Every transaction from your bank feeds captured and coded to the right account. Anything we need from you arrives as one short list.',
      covered: 'Your books reflect what really happened, and you only hear from us when we need something.',
    },
    {
      title: 'Bank accounts reconciled',
      description:
        'Every bank account and credit card reconciled to its statement, with any differences found and cleared.',
      covered: 'Your books match your bank, so the numbers you decide from are numbers you can trust.',
    },
    {
      title: 'Insights Report and performance review',
      description:
        'Your management accounts, a profit and loss and balance sheet with what they mean for the business, followed by a review with your accountant. Quarterly on Basic, monthly on Pro and weekly on Premium.',
      covered: 'You leave each review knowing what changed and what to do next.',
    },
  ],
};

export const PAYROLL: ServicePage = {
  slug: 'payroll',
  title: 'Payroll',
  href: '/payroll',
  hook: 'Pay day, without the panic.',
  body: 'Your people are paid correctly, and you stop carrying SARS dates in your head. Wages flow straight into your books, so nothing is captured twice.',
  items: [
    {
      title: 'Payroll processing and payslips',
      description:
        "Gross pay, deductions and net pay calculated each month, including overtime, commission, new starters and leavers. Payslips ready for pay day once the month's changes are in.",
      covered: 'Your people are paid correctly, and you tell us about a change once.',
    },
    {
      title: 'EMP201: PAYE and UIF every month',
      description:
        'Your EMP201 prepared and submitted to SARS each month, with PAYE, UIF and SDL where it applies, and the payment reconciled to the declaration.',
      covered: 'The monthly SARS deadline is handled, so it stops living in your head.',
    },
    {
      title: 'EMP501 and IRP5 certificates',
      description:
        'The EMP501 reconciliation submitted twice a year, and IRP5 certificates issued for every employee at year-end.',
      covered: 'Your employees can file their own tax returns without waiting on you.',
    },
    {
      title: 'COIDA Return of Earnings',
      description:
        'Your Return of Earnings filed with the Compensation Fund each year, based on your real payroll figures.',
      covered: 'Your workers are covered for injuries on the job, and your letter of good standing stays valid for tenders and contracts.',
    },
  ],
};

/** Homepage card order (Zjak, 2026-10-11). */
export const SERVICE_PAGES: ServicePage[] = [ACCOUNTING, BOOKKEEPING, PAYROLL];
