// The qualifying questions on /contact (decision 2026-10-12: every "Book a fit
// call" goes through these first, and the booking link appears only after the
// answers are sent). The option strings are stored as-is in leads.config and
// read in the owner email, so they are the labels, not codes. The server
// validates against these same lists (ContactAnswersSchema in lib/validations).

export const TURNOVER_OPTIONS = [
  'Not trading yet',
  'Under R1m',
  'R1m to R5m',
  'R5m to R20m',
  'R20m to R50m',
  'Over R50m',
] as const;

export const TEAM_SIZE_OPTIONS = ['Just me', '2 to 5', '6 to 20', '21 to 50', 'More than 50'] as const;

export const SERVICE_OPTIONS = [
  'Bookkeeping and Xero',
  'Annual financial statements',
  'Tax (income, provisional, VAT)',
  'Payroll',
  'Not sure yet',
] as const;

export const BOOKS_NOW_OPTIONS = [
  'I do them myself',
  'Someone on my team',
  'Another accounting firm',
  'Nobody at the moment',
] as const;

export const MAIN_REASON_OPTIONS = [
  'My books are behind',
  'I worry about SARS or CIPC deadlines',
  'I don’t get numbers I can run the business on',
  'I’m unhappy with my current accountant',
  'I’m starting a new business',
  'Something else',
] as const;

export const CONTACT_QUESTIONS = {
  turnover: { label: 'Annual turnover', options: TURNOVER_OPTIONS },
  teamSize: { label: 'People in the business, including you', options: TEAM_SIZE_OPTIONS },
  services: { label: 'What do you need help with?', hint: 'Pick all that apply.', options: SERVICE_OPTIONS },
  booksNow: { label: 'Who does your books now?', options: BOOKS_NOW_OPTIONS },
  mainReason: { label: 'What made you look for an accountant now?', options: MAIN_REASON_OPTIONS },
} as const;
