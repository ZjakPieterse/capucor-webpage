import {
  CalendarCheck,
  Cloud,
  FileText,
  type LucideIcon,
  Receipt,
  ShieldCheck,
  Users,
} from 'lucide-react';

// One icon per core item (PACKAGE_COMMON_ITEMS), keyed by its text so the
// VAT-filtered list keeps the right icons. Used by the pricing-page panel and
// the homepage "Included in every package" strip.
const ICONS: Record<string, LucideIcon> = {
  'Dedicated Finance Team': Users,
  'Annual Financials': FileText,
  'SARS & CIPC Submission': ShieldCheck,
  'Xero Accounting Software': Cloud,
  'Year-round Support': CalendarCheck,
  'VAT returns (VAT201)': Receipt,
};

export function commonItemIcon(text: string): LucideIcon {
  return ICONS[text] ?? ShieldCheck;
}
