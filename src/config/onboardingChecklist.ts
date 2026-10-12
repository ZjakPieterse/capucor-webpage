// What a new client gathers before their first month (90-day roadmap
// interview, 2026-10-12). One list, used three ways: the "What we'll need"
// card on the homepage (`item` only), the printable page at
// /resources/onboarding-checklist (`item` + `detail`), and, once it is built,
// the welcome checklist sent on signing. Keep the three the same list.
// No bank feeds yet: name Xero access or set-up only (Zjak, 2026-10-12).
// Registrations (UIF, COIDA and the like) are done on request and charged
// separately; they are outside every subscription (Zjak, 2026-10-12).
export const ONBOARDING_CHECKLIST = [
  {
    item: "CIPC registration info and docs",
    detail:
      "Your registration certificate (CoR14.3) and a list of your directors or members.",
  },
  {
    item: "SARS tax numbers and access",
    detail:
      "Your income tax number, plus your VAT and PAYE numbers if you’re registered. We send an access request from our tax practitioner eFiling profile, and you approve it. If you ever leave, we hand it back.",
  },
  {
    item: "UIF and COIDA references, if registered",
    detail:
      "Both come from the Department of Employment and Labour. Not registered yet? We can register you on request, quoted separately from your subscription.",
  },
  {
    item: "Xero access if you already use it",
    detail:
      "Invite us as an adviser and we move your Xero file onto our subscription, so it’s included in your fee. No Xero yet? We set it up.",
  },
  {
    item: "Your latest financials and trial balance",
    detail:
      "Your last financial statements and trial balance. Your previous accountant usually has these. A detailed ledger, debtors and creditors balances and a fixed asset register help too, if you have them.",
  },
  {
    item: "Your latest payroll and employee info",
    detail:
      "Your last payslips or payroll report, and each employee’s details, so your staff are paid as usual on their next payday.",
  },
];

export const ONBOARDING_CHECKLIST_META = {
  title: "Your Capucor onboarding checklist",
  subtitle:
    "Everything we need to start your first month. Most of it you already have somewhere. The sooner it’s back, the sooner your monthly rhythm starts.",
};
