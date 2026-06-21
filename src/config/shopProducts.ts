/**
 * Once-off add-on services for the client portal shop (B2/B3).
 *
 * Interim, dependency-free catalogue — same pattern as src/config/keyDates.ts.
 * The `shop_products` table already exists (migration 004) but is unseeded;
 * keeping the catalogue static means the shop renders with zero DB action.
 * When Paystack checkout lands (B4/B5) we swap this for a seeded DB read so
 * `shop_orders.product_id` has a real FK target.
 *
 * Prices are once-off starter placeholders — confirm the SKUs + amounts
 * before the shop is shown to live clients.
 */

import {
  FileText,
  Calculator,
  ClipboardCheck,
  Building2,
  ShieldCheck,
  Receipt,
  type LucideIcon,
} from 'lucide-react';

export interface ShopProduct {
  slug: string;
  name: string;
  /** Once-off price in ZAR. */
  priceZAR: number;
  /** One-line summary for the catalogue card. */
  summary: string;
  /** Fuller description for the detail page. */
  description: string;
  /** What the client gets. */
  includes: string[];
  /** Typical turnaround once we have what we need. */
  turnaround: string;
  icon: LucideIcon;
}

export const SHOP_PRODUCTS: ShopProduct[] = [
  {
    slug: 'company-tax-return',
    name: 'Company income tax return (ITR14)',
    priceZAR: 2500,
    summary: 'A standalone ITR14 filing for a past or current year of assessment.',
    description:
      'A complete company income tax return for one year of assessment, handled end to end. Ideal if you have a return outstanding, or need a year filed outside your monthly plan.',
    includes: [
      'Tax computation from your annual financial statements',
      'ITR14 prepared and submitted via SARS eFiling',
      'Handling of SARS verification correspondence',
      'A copy of the filed return for your records',
    ],
    turnaround: '5–7 business days from receiving your AFS',
    icon: FileText,
  },
  {
    slug: 'provisional-tax',
    name: 'Provisional tax submission (IRP6)',
    priceZAR: 850,
    summary: 'One IRP6 estimate prepared and filed for a provisional period.',
    description:
      'A single provisional tax (IRP6) submission for the 1st or 2nd period. We estimate taxable income, calculate the payment due and file before the SARS deadline.',
    includes: [
      'Taxable income estimate for the period',
      'IRP6 prepared and submitted via eFiling',
      'Payment amount and reference confirmed to you',
      'Deadline tracked so nothing is filed late',
    ],
    turnaround: '3–5 business days before the period deadline',
    icon: Calculator,
  },
  {
    slug: 'annual-financial-statements',
    name: 'Annual financial statements',
    priceZAR: 4500,
    summary: 'A compiled set of AFS for one financial year.',
    description:
      'A full compilation of your annual financial statements for one financial year, prepared to the applicable reporting framework and ready for tax, the bank or shareholders.',
    includes: [
      'Income statement, balance sheet and notes',
      'Compiled to the applicable reporting framework',
      'Compilation report signed by the practice',
      'PDF set delivered to your Drive folder',
    ],
    turnaround: '7–10 business days from a complete trial balance',
    icon: ClipboardCheck,
  },
  {
    slug: 'cipc-annual-return',
    name: 'CIPC annual return',
    priceZAR: 450,
    summary: 'We file your annual return with CIPC and keep you in good standing.',
    description:
      'Your CIPC annual return filed for the current cycle, including the prescribed CIPC fee. Keeps the company compliant and avoids deregistration.',
    includes: [
      'Annual return lodged with CIPC',
      'Prescribed CIPC filing fee included',
      'Filing confirmation sent to you',
      'Beneficial ownership check flagged if due',
    ],
    turnaround: '2–3 business days',
    icon: Building2,
  },
  {
    slug: 'compliance-health-check',
    name: 'Compliance health check',
    priceZAR: 1500,
    summary: 'A once-off review of where your business stands with SARS and CIPC.',
    description:
      'A structured review of your tax, payroll and statutory status: what is registered, what is outstanding and what is at risk, with a short written action list.',
    includes: [
      'SARS profile review (income tax, VAT, PAYE)',
      'CIPC standing and outstanding returns',
      'Outstanding submissions and penalties flagged',
      'Written action list with priorities',
    ],
    turnaround: '5 business days',
    icon: ShieldCheck,
  },
  {
    slug: 'vat-registration',
    name: 'VAT registration',
    priceZAR: 1200,
    summary: 'We register your business for VAT with SARS.',
    description:
      'A managed VAT registration with SARS, whether you have crossed the compulsory threshold or are registering voluntarily. We prepare the application and supporting documents.',
    includes: [
      'Eligibility and threshold check',
      'Application prepared and submitted to SARS',
      'Supporting document pack assembled',
      'VAT number and effective date confirmed',
    ],
    turnaround: '10–21 business days, subject to SARS',
    icon: Receipt,
  },
];

export function getShopProduct(slug: string): ShopProduct | undefined {
  return SHOP_PRODUCTS.find((p) => p.slug === slug);
}
