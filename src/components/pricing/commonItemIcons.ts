import {
  Cloud,
  FileText,
  type LucideIcon,
  Receipt,
  ShieldCheck,
  Users,
} from 'lucide-react';

// One icon per core item (PACKAGE_COMMON_ITEMS), keyed by its text so the
// VAT-filtered list keeps the right icons. Used by the pricing-page panel.
const ICONS: Record<string, LucideIcon> = {
  'Year-round Finance Team': Users,
  'Annual Financials': FileText,
  'SARS & CIPC Returns': ShieldCheck,
  'Xero Accounting Software': Cloud,
  'VAT returns (VAT201)': Receipt,
};

export function commonItemIcon(text: string): LucideIcon {
  return ICONS[text] ?? ShieldCheck;
}
