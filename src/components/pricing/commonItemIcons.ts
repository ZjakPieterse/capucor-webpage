import {
  CalendarCheck,
  Cloud,
  FileText,
  Layers,
  type LucideIcon,
  Receipt,
  ShieldCheck,
  Users,
} from 'lucide-react';

// One icon per core item (PACKAGE_COMMON_ITEMS), keyed by its text so the
// VAT-filtered list keeps the right icons. Used by the pricing-page strip and
// the homepage "Included in every package" strip.
const ICONS: Record<string, LucideIcon> = {
  'Your Own Accountant': Users,
  'Xero Software Included': Cloud,
  'SARS & CIPC Compliance': ShieldCheck,
  'Annual Financial Statements': FileText,
  'VAT Returns (VAT201)': Receipt,
  'Bookkeeping & Monthly Close': Layers,
  'Year-round Support': CalendarCheck,
};

export function commonItemIcon(text: string): LucideIcon {
  return ICONS[text] ?? ShieldCheck;
}
