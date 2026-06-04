// Content for the SME compliance-calendar lead magnet, rendered at
// /resources/compliance-calendar and gated behind the homepage "guide" tab.
//
// IMPORTANT — accuracy: these are the standard recurring cycles for a South
// African company/employer. Exact dates shift year to year (SARS announces
// filing-season dates annually; CIPC and the Compensation Fund adjust windows
// and grant extensions). Treat this as the cadence, not a promise of a specific
// date. The page carries a visible disclaimer; keep LAST_REVIEWED current and
// re-check the cycles each tax year before promoting changes.

export const COMPLIANCE_CALENDAR_META = {
  title: 'The South African SME compliance calendar',
  subtitle:
    'The recurring SARS, CIPC and payroll deadlines that keep a small business in the clear, on one page.',
  // Update when the cycles below are re-checked against SARS / CIPC for the year.
  lastReviewed: 'June 2026',
  disclaimer:
    'This is a general guide to the standard cycle, not tax advice. Exact dates change each year and depend on your financial year-end and VAT category. SARS announces filing-season dates annually, and CIPC and the Compensation Fund adjust their windows. Confirm current deadlines with SARS, CIPC, or your Capucor accountant before you rely on them.',
} as const;

export interface CalendarItem {
  name: string;
  /** Who it applies to. */
  who: string;
  /** The headline timing. */
  when: string;
  /** A short plain-language note. */
  detail: string;
}

export interface CalendarGroup {
  cadence: string;
  items: CalendarItem[];
}

export const COMPLIANCE_CALENDAR: CalendarGroup[] = [
  {
    cadence: 'Every month',
    items: [
      {
        name: 'PAYE, UIF & SDL (EMP201)',
        who: 'Employers',
        when: 'By the 7th',
        detail:
          'Submit the EMP201 and pay PAYE, UIF and SDL by the 7th of the following month. If the 7th falls on a weekend or public holiday, pay by the last business day before it.',
      },
      {
        name: 'VAT (VAT201) — monthly vendors',
        who: 'Category C vendors',
        when: 'By the 25th / last business day',
        detail:
          'Vendors registered for monthly VAT submit and pay by the 25th (manual) or the last business day of the month (eFiling and EFT) after each tax period.',
      },
    ],
  },
  {
    cadence: 'Every two months',
    items: [
      {
        name: 'VAT (VAT201) — most vendors',
        who: 'Category A & B vendors',
        when: 'By the 25th / last business day',
        detail:
          'Most vendors file VAT every second month. Category A and Category B run on alternating two-month cycles; submit and pay by the 25th (manual) or the last business day (eFiling and EFT) after the period.',
      },
    ],
  },
  {
    cadence: 'Twice a year',
    items: [
      {
        name: 'Provisional tax (IRP6)',
        who: 'Companies & provisional taxpayers',
        when: '1st: 31 Aug · 2nd: end Feb',
        detail:
          'For taxpayers with a February year-end: the first period is due by 31 August and the second by the last day of February. An optional third "top-up" payment can be made by the end of September to limit interest. Companies with a different year-end follow the equivalent points in their own year.',
      },
      {
        name: 'PAYE reconciliation (EMP501)',
        who: 'Employers',
        when: 'Interim: ~Sep–Oct · Annual: ~Apr–May',
        detail:
          'The interim reconciliation covers March–August and the annual reconciliation covers the full tax year, issuing IRP5/IT3(a) certificates. SARS sets the exact submission windows each year.',
      },
    ],
  },
  {
    cadence: 'Once a year',
    items: [
      {
        name: 'Company income tax (ITR14)',
        who: 'Companies',
        when: 'Within 12 months of year-end',
        detail:
          'File the company income tax return within 12 months after the end of the company financial year.',
      },
      {
        name: 'Individual income tax (ITR12)',
        who: 'Business owners',
        when: 'During tax season',
        detail:
          'Tax season usually opens in July. Non-provisional taxpayers typically have an October deadline; provisional taxpayers have until January. SARS confirms the dates each year.',
      },
      {
        name: 'CIPC annual return',
        who: 'Companies & close corporations',
        when: 'On the incorporation anniversary',
        detail:
          'Companies file within 30 business days after the anniversary of incorporation; close corporations file within the anniversary month. The beneficial ownership declaration is filed alongside the annual return.',
      },
      {
        name: 'Return of Earnings (COIDA)',
        who: 'Employers',
        when: 'Submission window ~Apr–May',
        detail:
          'File the Return of Earnings (W.As.8) with the Compensation Fund each year to keep your Letter of Good Standing current. The window usually runs from 1 April, with the deadline often extended.',
      },
    ],
  },
];
