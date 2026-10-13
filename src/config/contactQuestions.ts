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

export const BOOKS_NOW_OPTIONS = [
  'I do them myself',
  'Someone on my team',
  'Another accounting firm',
  'Nobody at the moment',
] as const;

export const SERVICE_OPTIONS = [
  'Bookkeeping and Xero',
  'Annual financial statements',
  'Tax (income, provisional, VAT)',
  'Payroll',
  'Not sure yet',
] as const;

// Form order (Zjak, 2026-10-12): three dropdowns, then the services checklist.
// "What made you look for an accountant now?" was dropped the same day.
// Labels "Annual revenue" / "Team size" (sentence case, full-site audit 2026-10-13) and one shared placeholder: Zjak, 2026-10-13.
const PICK = 'Choose an option';

export const CONTACT_QUESTIONS = {
  turnover: { label: 'Annual revenue', placeholder: PICK, options: TURNOVER_OPTIONS },
  teamSize: { label: 'Team size', placeholder: PICK, options: TEAM_SIZE_OPTIONS },
  booksNow: { label: 'Who does your books now?', placeholder: PICK, options: BOOKS_NOW_OPTIONS },
  services: { label: 'What do you need help with?', options: SERVICE_OPTIONS },
} as const;

// Which of the two buttons sent the form (Zjak, 2026-10-13). Stored with the
// answers, so the owner email says whether a booking is on its way.
export const NEXT_STEP_OPTIONS = ['message', 'meeting'] as const;
export type NextStep = (typeof NEXT_STEP_OPTIONS)[number];
