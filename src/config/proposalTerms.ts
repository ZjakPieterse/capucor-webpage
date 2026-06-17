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

export interface TermsBlock {
  /** Stable id so the proposal page can pick which blocks to show inline. */
  id: string;
  heading: string;
  paragraphs: string[];
}

/** What Capucor does. */
export const RESPONSIBILITIES_OURS: string[] = [
  'Do the work in your schedule on its agreed cycle, and submit your SARS and CIPC filings on time.',
  'Keep your books reconciled and give you the reports listed in your package.',
  'Tell you in good time about payments that fall due, and flag anything that needs a decision.',
  'Act with reasonable care and skill, in line with the SAICA code we work under.',
];

/** Footnotes shown under the fee total (proposal document + archived PDF). */
export const FEES_NOTES: string[] = [
  'Billed monthly in advance. Your first close runs in the following new month.',
  'The figure above is the all-inclusive monthly price. VAT, where it applies, is shown on your Xero invoice, not here.',
  'Processing for the 3 months before your start date is included. Older periods are considered catch-up work and will be billed separately.',
];

/** What the client does. */
export const RESPONSIBILITIES_YOURS: string[] = [
  'Give us your bank statements, invoices and supporting documents in good time each cycle.',
  'Make sure the information you give us is complete and accurate, and tell us when things change.',
  'Approve returns and reports before we submit or file them where we ask you to.',
  'Keep your own copies of your records — we work mainly in the cloud (Xero), and the originals stay yours.',
];

/**
 * Full engagement terms. The proposal shows a curated subset inline (see
 * INLINE_TERM_IDS) and links here for the rest; /terms/engagement shows all.
 */
export const PROPOSAL_TERMS: TermsBlock[] = [
  {
    id: 'period-review',
    heading: 'Period of engagement and quarterly review',
    paragraphs: [
      'This engagement starts on your agreed start date and runs month to month until either of us ends it. There is no fixed term and no lock-in.',
      'We review the engagement every quarter. Your fee and allowances are set against your rolling average over the last 3 to 12 months, so one busy month does not move your price and a quiet one is not held against you. Any change applies from the next billing cycle and is never back-dated.',
    ],
  },
  {
    id: 'fair-usage',
    heading: 'Fair usage and what falls outside it',
    paragraphs: [
      'Each service in your schedule has an allowance tied to the bracket you chose (your turnover band, transaction count or headcount). Work within that allowance is covered by your monthly fee.',
      'Processing for the 3 months before your start date is included free of charge. Anything older than that is out of scope, treated as catch-up work, and quoted separately before we begin it.',
      'When work runs beyond your allowance, we measure it on the quarterly review against your rolling average rather than reacting to a single month, then adjust by agreement.',
    ],
  },
  {
    id: 'changes',
    heading: 'Changes to your services',
    paragraphs: [
      'Need something added or removed? We will quote it and send you an updated proposal to sign before we start. Your current proposal stays in force until you accept the new one.',
      'Work that is not listed in your schedule is out of scope until we have agreed it in writing.',
    ],
  },
  {
    id: 'debit-order',
    heading: 'Debit-order authorisation',
    paragraphs: [
      'By signing this proposal you authorise Capucor Business Solutions to collect the agreed monthly fee, and any agreed adjustments, by debit order against your nominated bank account.',
      'We do not capture or store your bank account details on this website. We set up the debit order with you directly when your account is onboarded. Collections run on the agreed day each month, and you will know the amount in advance.',
      'You can cancel the debit-order authorisation in writing at any time. Cancelling the authorisation does not on its own cancel this agreement, and does not affect amounts already due.',
    ],
  },
  {
    id: 'confidentiality',
    heading: 'Confidentiality and POPIA',
    paragraphs: [
      'We keep your information confidential and process it in line with POPIA. We only share it with the parties needed to do your work — for example SARS, CIPC or your software providers — or where the law requires it.',
      'We may use trusted sub-processors (such as Xero and our hosting and email providers) under the same confidentiality terms.',
    ],
  },
  {
    id: 'ownership',
    heading: 'Your records and our work',
    paragraphs: [
      'Your source documents and records stay yours, and we return them to you on request. The financial statements, returns and reports we produce are yours to use in your business.',
      'The templates, working papers, checklists and software we build to do the work stay ours.',
    ],
  },
  {
    id: 'scope-limits',
    heading: 'Scope of our work',
    paragraphs: [
      'We act as your accountants, not your auditors. Our work is a compilation based on the information you give us, so it is not designed to find fraud, theft or every error, and it is not an audit or an assurance opinion.',
      'Our advice is based on the law as it stands when we give it and on the facts you share with us.',
    ],
  },
  {
    id: 'liability',
    heading: 'Limitation of liability',
    paragraphs: [
      'Our liability for any claim arising from this engagement is limited to the fees you have paid us for the specific work the claim relates to.',
      'We are not liable for losses caused by information that was given to us late, incomplete or inaccurate.',
    ],
  },
  {
    id: 'fica',
    heading: 'FICA and legal duties',
    paragraphs: [
      'We are required by law to verify who we act for and, in limited cases, to report certain transactions to the Financial Intelligence Centre. By signing, you agree to give us the verification documents we ask for.',
    ],
  },
  {
    id: 'termination',
    heading: 'Ending the engagement',
    paragraphs: [
      'Either of us can end this agreement with 30 days’ written notice. We will help with a clean handover and return your records.',
      'We may pause work if fees fall significantly overdue, after letting you know first.',
    ],
  },
  {
    id: 'jurisdiction',
    heading: 'Governing law',
    paragraphs: [
      'This agreement is governed by South African law, and any dispute is subject to the jurisdiction of the Magistrate’s Court.',
    ],
  },
];

/** Blocks shown in full on the proposal itself; the rest sit behind the link. */
export const INLINE_TERM_IDS = ['period-review', 'changes', 'scope-limits', 'liability'] as const;
