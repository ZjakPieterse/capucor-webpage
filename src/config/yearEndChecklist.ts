/**
 * Year-end / annual financial statements prep checklist for the client portal.
 *
 * Static content for an interactive (on-device) checklist — the client ticks
 * items as they gather them, progress is saved to localStorage. No DB, nothing
 * to apply. A planning aid, not a substitute for the accountant's working paper.
 */

export interface ChecklistItem {
  id: string;
  label: string;
  hint?: string;
}

export interface ChecklistSection {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export const YEAR_END_CHECKLIST: ChecklistSection[] = [
  {
    id: 'bank-cash',
    title: 'Bank & cash',
    items: [
      {
        id: 'bank-statements',
        label: 'Bank statements for every account, up to year-end date',
        hint: 'Include credit cards, savings and any account the business used, even occasionally.',
      },
      { id: 'bank-recon', label: 'Closing balances reconciled to the bank statements' },
      { id: 'loan-statements', label: 'Loan and finance statements showing the year-end balance' },
      { id: 'petty-cash', label: 'Petty cash counted and the float confirmed' },
    ],
  },
  {
    id: 'income',
    title: 'Sales & income',
    items: [
      { id: 'invoices-issued', label: 'All sales invoices for the year captured' },
      {
        id: 'deposits-advances',
        label: 'Customer deposits and advances identified',
        hint: 'Money received for work not yet done is not income this year — flag it.',
      },
      { id: 'bad-debts', label: 'List of bad debts to write off' },
      { id: 'other-income', label: 'Other income noted (interest, rebates, grants)' },
    ],
  },
  {
    id: 'expenses',
    title: 'Purchases & expenses',
    items: [
      { id: 'supplier-invoices', label: 'Supplier invoices and slips for the year captured' },
      {
        id: 'accruals',
        label: 'Costs incurred but not yet invoiced listed (accruals)',
        hint: 'e.g. the December audit done but billed in January.',
      },
      {
        id: 'prepayments',
        label: 'Prepaid expenses split out',
        hint: 'Insurance or rent paid in advance that covers the next year.',
      },
    ],
  },
  {
    id: 'assets-stock',
    title: 'Assets & stock',
    items: [
      { id: 'stock-count', label: 'Stock counted and valued at year-end (if you carry stock)' },
      {
        id: 'asset-additions',
        label: 'Fixed asset purchases and disposals, with invoices',
        hint: 'Equipment, vehicles, computers bought or sold during the year.',
      },
      { id: 'asset-register', label: 'Asset register agreed and depreciation policy confirmed' },
    ],
  },
  {
    id: 'payroll',
    title: 'Payroll & people',
    items: [
      { id: 'payroll-recon', label: 'Payroll reconciled to the EMP501 and IRP5s' },
      { id: 'leave-bonus', label: 'Leave pay and bonus accruals confirmed' },
      { id: 'director-pay', label: "Directors' remuneration for the year confirmed" },
    ],
  },
  {
    id: 'tax-statutory',
    title: 'Tax & statutory',
    items: [
      { id: 'vat-recon', label: 'VAT reconciled to the VAT201 returns for the year' },
      { id: 'provisional-tax', label: 'Provisional tax payments (IRP6) for the year listed' },
      {
        id: 'loan-accounts',
        label: 'Director and shareholder loan accounts reconciled',
        hint: 'Money moved between you and the company, both directions.',
      },
      { id: 'prior-adjustments', label: 'Any prior-year adjustments or queries noted' },
    ],
  },
];

export const YEAR_END_TOTAL_ITEMS = YEAR_END_CHECKLIST.reduce(
  (sum, section) => sum + section.items.length,
  0,
);
