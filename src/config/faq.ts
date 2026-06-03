export interface FaqItem {
  question: string;
  answer: string;
}

export const faqs: FaqItem[] = [
  {
    question: "What's included in each subscription tier?",
    answer:
      'The tier you choose sets the depth of service across your selected services. Basic covers core compliance: monthly bookkeeping, annual financial statements, income tax and provisional tax returns, VAT201 submissions, and quarterly management accounts. Pro adds weekly bookkeeping processing, monthly management accounts, and annual tax planning. Premium adds daily processing, budget vs actuals, a live KPI dashboard, and monthly tax strategy. Payroll is a standalone add-on available at any tier. Full detail is in the pricing calculator.',
  },
  {
    question: "What's the difference between bookkeeping and accounting?",
    answer:
      'Bookkeeping is the ongoing work: capturing transactions, reconciling bank accounts, and keeping your ledger current each month. Accounting is what happens with those records: financial statements, tax returns, VAT submissions, and CIPC filings. Most businesses need both. Our subscriptions can include one or both, depending on what you already have in place.',
  },
  {
    question: 'How is pricing calculated?',
    answer:
      'Pricing depends on two things: which services you need (accounting, bookkeeping, payroll, or any combination) and the bracket that matches your business size. For accounting and bookkeeping the bracket is based on your annual turnover. For payroll it is the number of employees. Select a tier (Basic, Pro, or Premium) and the calculator shows your exact monthly price before you speak to anyone.',
  },
  {
    question: 'How do I switch from my current accountant?',
    answer:
      "We manage the transition. After your discovery call we request your prior-year financial statements and Xero access, or migrate your data into Xero if you are on another platform. Most transitions complete within two weeks.",
  },
  {
    question: 'Do you only work with South African businesses?',
    answer:
      'Yes. Capucor is set up specifically for South African SMEs registered with CIPC. Our compliance work covers SARS income tax, provisional tax, VAT, PAYE, and UIF, plus CIPC annual returns and COIDA. If your business is registered and operating in South Africa, we can work with you.',
  },
  {
    question: 'What happens if SARS sends me a query or audit?',
    answer:
      "We handle it with you. SARS correspondence goes through to our team. We review the query, prepare the supporting documents, and respond on your behalf. Clean, current books make SARS queries straightforward. Most are resolved without escalation. If it goes further, we are with you at every step.",
  },
  {
    question: 'What are your contract terms?',
    answer:
      'Month-to-month with 30 days written notice to cancel. No lock-in contracts. Prices are reviewed annually and any increase is communicated 60 days in advance. If you cancel, we prepare a full handover pack (financial statements, tax submissions, and Xero credentials) so your next accountant has everything they need from day one.',
  },
  {
    question: 'Do I need to be on Xero already?',
    answer:
      'No. If you are using another platform or working from spreadsheets, we migrate you to Xero as part of onboarding. The process typically takes three to five business days depending on the volume of historical data.',
  },
  {
    question: 'What do you need from us every month?',
    answer:
      'We need documents, approvals, payroll changes and answers to queries by the agreed monthly dates. The system works because both sides know what must happen and when. We make the requests clear, then process, review and report from there.',
  },
  {
    question: 'Will I lose control if I outsource my finance function?',
    answer:
      "No. You keep access to your systems and numbers. We take over the monthly discipline: processing, reconciliations, filings, reports and review. The goal is less admin for you, not less visibility.",
  },
  {
    question: 'Can you work with my existing bookkeeper or admin person?',
    answer:
      'Yes. We can take over the full function or work alongside your internal team. The right setup depends on what is already in place, where the bottlenecks are, and how much review and reporting support you need.',
  },
  {
    question: 'Who actually does the work on my books?',
    answer:
      'A small, named team. Day-to-day processing is done by a bookkeeper assigned to your business so the same person sees your transactions month after month. Every month-end is reviewed and signed off by a SAICA-registered accountant before anything reaches you or SARS. You always know who to email.',
  },
];
