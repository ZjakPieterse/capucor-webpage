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
  'Your own accountant': Users,
  'Xero software included': Cloud,
  'SARS & CIPC compliance': ShieldCheck,
  'Annual financial statements': FileText,
  'VAT returns (VAT201)': Receipt,
  'Bookkeeping & monthly close': Layers,
  'Year-round support': CalendarCheck,
};

export function commonItemIcon(text: string): LucideIcon {
  return ICONS[text] ?? ShieldCheck;
}
