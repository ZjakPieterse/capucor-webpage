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
      covered: 'Ready when the bank asks.',
    },
    {
      title: 'Income and provisional tax',
      description:
        "Your company's income tax return and provisional tax calculated correctly and submitted on time as each deadline in your tax year arrives, when we have your information in time.",
      covered: "No tax bill you didn't see coming.",
    },
    {
      title: 'VAT reports and submission',
      description:
        "If you're VAT-registered, your VAT201 prepared and submitted every cycle, monthly or every two months, with input and output VAT reconciled before it goes in.",
      covered: 'Every VAT cycle, handled.',
    },
    {
      title: 'CIPC annual compliance',
      description:
        "Your CIPC annual return and beneficial ownership declaration lodged together each year, with your company details kept up to date. These filings are what keep your company registered.",
      covered: 'Your company stays registered.',
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
      title: 'Xero accounting software',
      description:
        'Your Xero subscription is part of your fee, set up for your business with your bank feeds connected. Your records stay yours: if you ever leave, we hand over your Xero file.',
      covered: 'No extra software bill.',
    },
    {
      title: 'Transactions processed',
      description:
        'Every transaction from your bank feeds captured and coded to the right account. Anything we need from you arrives as one short list.',
      covered: 'Books that show what really happened.',
    },
    {
      title: 'Bank accounts reconciled',
      description:
        'Your bank accounts and credit cards, vehicle finance and other loan accounts, and point-of-sale (POS) accounts, reconciled regularly to their statements. Every balance stays current, and any differences are found and cleared.',
      covered: 'Numbers you can trust.',
    },
    {
      // The package line since the Premium redesign (2026-10-24): a written
      // expert verdict in the report, not a meeting.
      title: 'Insights report and business health check',
      description:
        "A written report on your key numbers, with our expert view of what's going well, what needs attention and what to do next. Quarterly on Basic, monthly on Pro and Premium.",
      covered: 'You know what to do next.',
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
      covered: 'Your team, paid correctly.',
    },
    {
      title: 'PAYE and UIF filed every month',
      description:
        'Your EMP201 prepared and submitted to SARS each month, with PAYE, UIF and SDL where it applies, and the payment reconciled to the declaration.',
      covered: 'One less SARS date to remember.',
    },
    {
      title: 'EMP501 recons and certificates',
      description:
        'The EMP501 reconciliation submitted twice a year, matching the PAYE, UIF and SDL you declared each month to what was paid, and IRP5 certificates issued for every employee at year-end.',
      covered: 'Staff file their tax without waiting on you.',
    },
    {
      title: 'COIDA annual compliance',
      description:
        'Your annual Return of Earnings filed on time from your real payroll figures, so your business stays compliant and your workers stay covered for injuries on the job.',
      covered: 'Your letter of good standing stays valid.',
    },
  ],
};

/** Homepage card order (Zjak, 2026-10-11). */
export const SERVICE_PAGES: ServicePage[] = [ACCOUNTING, BOOKKEEPING, PAYROLL];
