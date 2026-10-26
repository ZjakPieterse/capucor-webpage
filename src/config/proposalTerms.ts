/**
 * Engagement terms shown on the proposal document and the full /terms/engagement
 * page. Plain config so the wording can be edited without touching the page.
 *
 * Strings live in JS (not JSX), so normal apostrophes are fine here — the page
 * renders them via {paragraph}.
 *
 * Voice: written to the owner, concrete, no marketing filler. Checked against
 * docs/voice-and-copy.md.
 */

import { PAYROLL_ONLY_TIER } from '@/config/tiers';

/**
 * Version label of the engagement terms. Bump it on any change to the clause
 * text in this file; it is printed on /terms/engagement and the signed PDF.
 */
export const TERMS_VERSION = '2026.1';

/** The contracting entity, named on the terms page and the signed PDF (Zjak, 2026-10-26). */
export const CAPUCOR_LEGAL = {
  name: 'Capucor Holdings (Pty) Ltd',
  tradingAs: 'Capucor Business Solutions',
  registrationNumber: '2014/144982/07',
  address: '19 Blue Crane, 273 Von Willich Avenue, Centurion, 0157',
  email: 'team@capucor.com',
} as const;

export interface TermsBlock {
  /** Stable id so the proposal page can pick which blocks to show inline. */
  id: string;
  heading: string;
  paragraphs: string[];
}

// The service lines every package shares, accounting or payroll only.
const SERVICE_STANDARD_LINES: string[] = [
  // team@ is the client-facing address everywhere (Zjak, 2026-10-26).
  'Reply to your emails to team@capucor.com within 2 business days (we work Monday to Friday, 08:00 to 17:00), and set up a call by appointment when a question needs one.',
  // Zjak, 2026-10-18: the 2-business-day and Premium same-day reply times are
  // aims kept in the normal course, with exceptions both ways.
  'Reply times are our service standards, not guarantees. We meet them in the normal course and tell you when something will take longer.',
  'Act with reasonable care and skill, in line with the SAICA code we work under.',
];

const ACCURATE_INFORMATION = 'Make sure the information you give us is complete and accurate, and tell us when things change.';

/** What Capucor does. */
export const RESPONSIBILITIES_OURS: string[] = [
  'Do the work in your schedule on its monthly or annual cycle, and submit your SARS and CIPC filings on time.',
  'Keep your books reconciled and give you the reports listed in your package.',
  'Tell you in good time about payments that fall due, and flag anything that needs a decision.',
  ...SERVICE_STANDARD_LINES,
];

/** Footnotes shown under the fee total (proposal document + archived PDF). */
export const FEES_NOTES: string[] = [
  'Billed monthly in advance. Your first close runs in the following new month.',
  'This is the full monthly price. No VAT is added.',
  // No hourly rate (decision 9, 2026-10-26): catch-up work is always quoted first.
  'Work for the 3 months before you accept this proposal is included, provided it would have been in scope then. Older periods are catch-up work, which we quote before we begin.',
];

/** What the client does. */
export const RESPONSIBILITIES_YOURS: string[] = [
  'Give us your bank statements, invoices and supporting documents in good time each cycle.',
  ACCURATE_INFORMATION,
  'Approve returns and reports before we submit or file them where we ask you to.',
  'Keep your own copies of your records. We work mainly in the cloud (Xero), and the originals stay yours.',
];

// The payroll-only package (Zjak, 2026-10-18): no books, reports or Xero, so
// both lists speak of payroll. The service standards are the same.
export const PAYROLL_ONLY_RESPONSIBILITIES_OURS: string[] = [
  "Run your payroll every month, with payslips ready for pay day once the month's changes are in.",
  'Submit your EMP201 every month, your EMP501 reconciliations twice a year and your COIDA Return of Earnings every year on time, and issue IRP5 certificates at year-end.',
  'Tell you in good time about PAYE, UIF and SDL payments that fall due, and flag anything that needs a decision.',
  ...SERVICE_STANDARD_LINES,
];

// Payroll cut-off: 17:00, two business days before pay day (Zjak, 2026-10-26).
// The salaries playbook still has changes due four business days before pay
// day; the playbook is to be brought in line with these terms.
export const PAYROLL_ONLY_RESPONSIBILITIES_YOURS: string[] = [
  "Give us the month's payroll inputs (hours, overtime, commission, leave taken and leavers) by the payroll cut-off: 17:00, two business days before pay day.",
  "Give us each new starter's details (ID number, tax number, start date and pay terms) by the payroll cut-off before their first pay day.",
  ACCURATE_INFORMATION,
  // Zjak, 2026-10-18 (PR #166): no draft approval round; we finalise, then send.
  "Check each month's payslips and payrun report when we send them, and tell us before pay day if anything is wrong. Approve returns before we submit them where we ask you to.",
  'Keep your own copies of your employment and payroll records. The originals stay yours.',
];

/** The "what each of us does" lists for a proposal's package. */
export function responsibilitiesFor(tierSlug: string): { ours: string[]; yours: string[] } {
  return tierSlug === PAYROLL_ONLY_TIER
    ? { ours: PAYROLL_ONLY_RESPONSIBILITIES_OURS, yours: PAYROLL_ONLY_RESPONSIBILITIES_YOURS }
    : { ours: RESPONSIBILITIES_OURS, yours: RESPONSIBILITIES_YOURS };
}

/**
 * Full engagement terms. The proposal shows a curated subset inline (see
 * INLINE_TERM_IDS) and links here for the rest; /terms/engagement shows all.
 *
 * The signed proposal is the engagement letter (Zjak's decisions of
 * 2026-10-26), so these blocks carry the parties, payment, mandate, AFS,
 * POPIA, records, disputes and notices. One firm-wide text for every client.
 */
export const PROPOSAL_TERMS: TermsBlock[] = [
  {
    id: 'parties',
    heading: 'Who this agreement is between',
    paragraphs: [
      'This agreement is between Capucor Holdings (Pty) Ltd, registration number 2014/144982/07, trading as Capucor Business Solutions ("we" or "us"), and the business named in this proposal ("you"). The person who signs confirms that they are authorised to sign for the business.',
      'Your proposal sets out the services and fees, and these terms set out how we work together. If anything in these terms conflicts with your proposal, the proposal wins.',
      'We accept the engagement when you sign, subject to our identity checks. If those checks are not met, we may decline within 10 business days of your signature and will tell you in writing.',
    ],
  },
  {
    id: 'period-review',
    heading: 'Period of engagement and quarterly review',
    paragraphs: [
      'This engagement starts on the day you sign this proposal and runs month to month until either of us ends it. There is no fixed term and no lock-in.',
      'We review the engagement every quarter. Your fee and allowances are set against your rolling average over the last 3 to 12 months, so one busy month does not move your price and a quiet one is not held against you. Any change applies from the next billing cycle and is never back-dated.',
    ],
  },
  {
    id: 'fair-usage',
    heading: 'Fair usage and what falls outside it',
    paragraphs: [
      // Firm-wide wording (Zjak, 2026-10-26): one text for every client, so
      // the shared blocks name accounting, bookkeeping and payroll alike.
      'Each service in your schedule has an allowance tied to the bracket you chose for it, such as your annual turnover, your monthly transactions or the number of employees on your payroll. Work within those allowances is covered by your monthly fee.',
      'Work for the 3 months before you accept this proposal is included free of charge, provided it would have been in scope for those months. Anything older is out of scope and treated as catch-up work: we quote it, and start once you accept the quote in writing.',
      'When work runs beyond your allowance, we measure it on the quarterly review against your rolling average rather than reacting to a single month, then adjust by agreement.',
    ],
  },
  {
    id: 'changes',
    heading: 'Changes to your services',
    paragraphs: [
      'Need something added or removed? We will quote it and send you an updated proposal to sign before we start. Your current proposal stays in force until you accept the new one.',
      'Work that is not in your schedule, including catch-up work and once-off requests, is out of scope. We always quote it first and start only once you accept the quote in writing.',
    ],
  },
  {
    // Shown in its own box on the proposal page. Payments are manual (EFT)
    // until Paysoft Flow is switched on (Zjak, 2026-10-26), so the debit-order
    // authorisation applies once a debit order is set up.
    id: 'payment',
    heading: 'Fees and payment',
    paragraphs: [
      'Your monthly fee is billed in advance and is due on the 1st of each month. You pay it by EFT against our invoice, or by debit order once we have set one up with you.',
      'If we set up a debit order with you, signing this proposal authorises Capucor Holdings (Pty) Ltd to collect your monthly fee, and any fee change made under these terms, from the bank account you nominate on the 1st of each month (or the next business day). We never capture or store your bank details on this website, and you will know the amount in advance.',
      'You can cancel a debit-order authorisation in writing at any time. Cancelling it does not end this agreement or affect amounts already due.',
      'If a payment is still unpaid 30 days after its due date, we will tell you in writing, and we may pause work 7 days after that notice until your account is up to date. We charge no interest.',
      "We may update our prices once a year, from 1 March, with at least 30 days' written notice. If you don't accept the new price, you can end this agreement on the usual 30 days' notice.",
    ],
  },
  {
    id: 'mandate',
    heading: 'Acting for you and access to your systems',
    paragraphs: [
      'You appoint us to act for you before SARS, CIPC, the Department of Employment and Labour (UIF) and the Compensation Fund (COIDA) for the work in your schedule, including through our tax practitioner profile. You stay responsible for your own taxes and statutory payments, and for paying them on time.',
      'To do the work, we need access to the systems it runs on, such as SARS eFiling, Xero, SimplePay and your bank feeds. Where a system allows it, you add us as a user instead of sharing your own password, and you stay the owner of every account. When the engagement ends, we hand over anything we set up for you and you remove our access.',
    ],
  },
  {
    id: 'your-business',
    heading: 'Running your business',
    paragraphs: [
      'You are responsible for running your business: its internal controls, preventing and detecting fraud, and complying with the laws that apply to it.',
    ],
  },
  {
    id: 'afs',
    heading: 'Annual financial statements',
    paragraphs: [
      'Where your package includes them, we compile your annual financial statements under IFRS for SMEs, unless we agree another framework with you in writing. They are for your owners, SARS, CIPC and your bank, and carry our compilation report. They are not audited or reviewed.',
      'The directors are responsible for the financial statements, the records behind them and the judgements in them, and approve and sign them. We ask you to confirm in writing the explanations you give us, usually in a representation letter when you approve the statements.',
    ],
  },
  {
    id: 'confidentiality',
    heading: 'Confidentiality and POPIA',
    paragraphs: [
      'We keep your information confidential and process it in line with POPIA. We only share it with the parties needed to do your work, for example SARS, CIPC or your software providers, or where the law requires it.',
      "Where we process personal information for you, such as your employees' payroll details or your customers' details in your books, we do so only on your instructions and for the work in this agreement. We keep it confidential, keep reasonable security measures in place, and tell you as soon as we become aware of a breach.",
      'We may use trusted sub-processors (such as Xero and our hosting and email providers) under the same confidentiality terms. Some of them, such as Xero and Google, store data on servers outside South Africa, under laws or agreements that protect it to a standard similar to POPIA.',
    ],
  },
  {
    id: 'ownership',
    heading: 'Your records and our work',
    paragraphs: [
      'Your source documents and records stay yours, and we return them to you on request. What we produce for you, such as financial statements, returns, payslips and reports, is yours to use in your business.',
      'The templates, working papers, checklists and software we build to do the work stay ours.',
      'We keep copies of your records and our working papers for 5 years after the end of the tax year they relate to, or after this engagement ends, whichever is later, and then delete them securely. Keeping your original records for as long as the law requires (for example 7 years under the Companies Act) is your responsibility.',
    ],
  },
  {
    id: 'scope-limits',
    heading: 'Scope of our work',
    paragraphs: [
      'We act as your accountants, not your auditors. Our work, including any financial statements we compile and the payroll we run, is based on the information you give us. It is not designed to find fraud, theft or every error, and it is not an audit or an assurance opinion.',
      'Our advice is based on the law as it stands when we give it and on the facts you share with us.',
    ],
  },
  {
    id: 'liability',
    heading: 'Limitation of liability',
    paragraphs: [
      'Our liability for any claim arising from this engagement is limited to the fees you have paid us for the specific work the claim relates to. This limit does not apply to loss caused by our fraud, dishonesty or gross negligence.',
      'We are not liable for losses caused by information that was given to us late, incomplete or inaccurate.',
    ],
  },
  {
    // Policy wording, not "required by law" (decision 1, 2026-10-26): revisit
    // if the FIC question makes Capucor an accountable institution.
    id: 'fica',
    heading: 'Verifying who we act for',
    paragraphs: [
      'Before we start, we verify who you are and who acts for you, using ID and registration documents. Like every business, we must report suspicious transactions to the Financial Intelligence Centre.',
    ],
  },
  {
    id: 'previous-accountant',
    heading: 'Your previous accountant',
    paragraphs: [
      'You allow us to contact your previous accountant to ask for your records and any professional information we need before we take over.',
    ],
  },
  {
    id: 'termination',
    heading: 'Ending the engagement',
    paragraphs: [
      'Either of us can end this agreement with 30 days’ written notice. Your fees for the notice period are payable as usual, and we keep doing the work in your schedule until the agreement ends. We then help with a clean handover and return your records.',
    ],
  },
  {
    // ECTA s44 cooling-off for natural-person clients. In the shared terms so
    // the signed PDF carries it too, not only the terms page.
    id: 'individuals',
    heading: 'If you sign as an individual',
    paragraphs: [
      'If you sign this proposal as an individual (for example as a sole proprietor) rather than for a company, close corporation or trust, you may cancel it within 7 days of signing, without giving a reason and without penalty. We refund anything you have paid within 30 days of your cancellation.',
    ],
  },
  {
    id: 'jurisdiction',
    heading: 'Disputes and governing law',
    paragraphs: [
      'If a dispute arises, the party raising it tells the other in writing, and we meet or call within 10 business days to try to settle it. If it is not settled within 20 business days of that notice, either of us may take it to court, and we both consent to the jurisdiction of the Magistrate’s Court.',
      'This agreement is governed by South African law.',
    ],
  },
  {
    id: 'notices',
    heading: 'Notices and general terms',
    paragraphs: [
      'Email counts as writing under this agreement. We send notices to the email address on your proposal, and you send them to team@capucor.com. Our address for legal notices is 19 Blue Crane, 273 Von Willich Avenue, Centurion, 0157.',
      'This proposal and these terms are the whole agreement between us, and a change binds us only once it is agreed in writing, except a price update made under Fees and payment. If any clause is unenforceable, the rest still applies. Neither of us is responsible for a delay caused by events outside our reasonable control, such as a power or SARS system outage.',
    ],
  },
];

/** Blocks shown in full on the proposal itself; the rest sit behind the link. */
// 'payroll-only' is only in the payroll-only package's terms (proposalTermsFor).
// 'payment' has its own box on the proposal page. 'liability' must stay inline
// so the limit is drawn to the client's attention before signing (CPA s49).
export const INLINE_TERM_IDS = ['parties', 'payroll-only', 'period-review', 'changes', 'scope-limits', 'liability'] as const;

// Payroll-only fee footnotes: there is no month-end close, and the first run
// depends on when SimplePay is set up. The other notes are shared.
export const PAYROLL_ONLY_FEES_NOTES: string[] = [
  'Billed monthly in advance. We agree the month of your first payroll run with you when we set up your payroll in SimplePay.',
  ...FEES_NOTES.slice(1),
];

/** Fee footnotes for a proposal's package. */
export function feesNotesFor(tierSlug: string): string[] {
  return tierSlug === PAYROLL_ONLY_TIER ? PAYROLL_ONLY_FEES_NOTES : FEES_NOTES;
}

/**
 * How payroll on its own works, from the monthly salaries playbook. Shown on
 * /terms/engagement and in the payroll-only proposal document only, so the
 * accounting packages' terms are unchanged.
 */
export const PAYROLL_ONLY_TERMS: TermsBlock = {
  id: 'payroll-only',
  heading: 'How your payroll works',
  paragraphs: [
    'The Payroll package is a monthly payroll. We run it in SimplePay, give you payslips, file your PAYE, UIF and SDL on the EMP201 every month, do your EMP501 reconciliations and IRP5 certificates, and look after your COIDA annual compliance.',
    "Each month we ask for your changes before the cut-off. If we don't hear from you by then, we run payroll on last month's information. Changes that reach us after the cut-off normally go into the next month's run.",
    "Before pay day we send you the month's payslips and payrun report. You pay your employees, and your PAYE, UIF and SDL to SARS, yourself. We make no payments for you and hold no access to your bank account for salaries.",
    'We act for you, the employer. If one of your employees contacts us about their pay, we refer them to you.',
    'Weekly or fortnightly pay runs, employer registrations, employment contracts and CCMA or labour disputes are not part of this package.',
  ],
};

/** Full terms for a proposal's package: payroll-only adds how payroll works. */
export function proposalTermsFor(tierSlug: string): TermsBlock[] {
  return tierSlug === PAYROLL_ONLY_TIER ? [PAYROLL_ONLY_TERMS, ...PROPOSAL_TERMS] : PROPOSAL_TERMS;
}
