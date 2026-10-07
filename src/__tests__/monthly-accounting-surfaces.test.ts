import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db';

vi.mock('server-only', () => ({}));

import { priceProposalSelection } from '@/lib/proposalPricing';
import { buildSignedProposalPdfPayload } from '@/lib/portal/proposalPdfPayload';
import { ProposalSummary } from '@/components/pricing/ProposalSummary';
import {
  buildSignedClientMessage,
  buildSignedOwnerMessage,
  renderCreatedProposalClientEmail,
  renderSignedClientEmail,
} from '@/lib/email/messages.mjs';
import type { Bracket, Service, Tier } from '@/types';

// calculator-v2 review, batch 2: one "Monthly accounting" line on every surface,
// and proposals sent with the retired Xero invoicing charge still price as signed.

const ROWS = [
  { service_slug: 'accounting', ordinal: 5, label: '10 Mil – 15 Mil', basic_price: 1625, pro_price: 2125, premium_price: 3425 },
  { service_slug: 'bookkeeping', ordinal: 7, label: 'Up to 200', basic_price: 2250, pro_price: 2925, premium_price: 4725 },
  { service_slug: 'payroll', ordinal: 1003, label: 'Employees: 3', basic_price: 450, pro_price: 450, premium_price: 450 },
];

function adminWith(rows: typeof ROWS) {
  return {
    from: () => ({ select: () => ({ in: async () => ({ data: rows, error: null }) }) }),
  } as unknown as SupabaseClient<Database>;
}

// A Basic proposal sent before 2026-10-06 with the Xero invoicing Yes.
const OLD_BASIC = {
  services: ['accounting', 'bookkeeping'],
  brackets: { accounting: 5, bookkeeping: 7 },
  tierSlug: 'basic',
  addons: ['xero-invoicing'],
};

describe('a proposal sent with the retired xero-invoicing token', () => {
  it('still prices exactly as signed, the R 200 inside Monthly accounting', async () => {
    const priced = await priceProposalSelection(adminWith(ROWS), OLD_BASIC);
    if (!priced.ok) throw new Error(priced.error);
    expect(priced.data.monthlyTotalZAR).toBe(1625 + 2250 + 200);
    expect(priced.data.addonSlugs).toEqual(['xero-invoicing']);
    expect(priced.data.lineItems).toEqual([
      { slug: 'core', name: 'Monthly accounting', label: 'R10m to R15m · up to 200 transactions', price: 4075 },
    ]);
  });

  it('renders the same one line and total in the signed PDF', async () => {
    const priced = await priceProposalSelection(adminWith(ROWS), OLD_BASIC);
    if (!priced.ok) throw new Error(priced.error);
    const { html } = buildSignedProposalPdfPayload(
      {
        id: 'p1',
        ref_number: 'FT-2026-10-0001',
        version: 1,
        first_name: 'Pat',
        last_name: 'Patterson',
        business_name: 'Pat Trading Co',
        services: OLD_BASIC.services,
        brackets: OLD_BASIC.brackets,
        tier_slug: 'basic',
        addons: OLD_BASIC.addons,
        sent_at: '2026-10-28T08:00:00Z',
        expires_at: '2026-11-04T08:00:00Z',
        signed_at: '2026-11-02T08:00:00Z',
        signature_name: 'Pat Patterson',
        signature_method: 'typed',
        signature_image: null,
        signature_ip: null,
      },
      { services: [], brackets: ROWS as unknown as Bracket[] },
      priced.data,
    );
    expect(html).toContain('Monthly accounting');
    expect(html).toContain('R 4,075');
    expect(html).not.toMatch(/>Accounting<|>Bookkeeping</);
    // First debit dated from the signature (F23): signed 2 November → 1 December.
    expect(html).toMatch(/First debit order:<\/strong> 1 December 2026/);
  });
});

describe('the signing page and calculator summary (ProposalSummary)', () => {
  const services = [
    { slug: 'accounting', name: 'Accounting' },
    { slug: 'bookkeeping', name: 'Bookkeeping' },
    { slug: 'payroll', name: 'Payroll' },
  ] as Service[];
  const tiers = [{ slug: 'pro', name: 'Pro' }] as Tier[];

  it('shows one Monthly accounting line with plain band labels and the payroll line', () => {
    const html = renderToStaticMarkup(
      createElement(ProposalSummary, {
        services,
        brackets: ROWS as unknown as Bracket[],
        tiers,
        selectedServices: ['accounting', 'bookkeeping', 'payroll'],
        selectedBrackets: { accounting: 5, bookkeeping: 7, payroll: 1003 },
        tierSlug: 'pro',
        selectedAddons: [],
      }),
    );
    expect(html).toContain('Monthly accounting');
    expect(html).toContain('R10m to R15m · up to 200 transactions');
    expect(html).toContain('R 5,050');
    expect(html).toContain('3 employees');
    expect(html).not.toMatch(/>Accounting<|>Bookkeeping</);
  });
});

describe('emails after signing (F10, F25)', () => {
  const d = {
    firstName: 'Pat',
    businessName: 'Pat Trading Co',
    signedAt: '2026-10-06T08:00:00Z',
  };
  const proposal = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'Pat@Example.com',
    first_name: 'Pat',
    last_name: 'Patterson',
    business_name: 'Pat Trading Co',
    ref_number: 'FT-2026-10-0001',
    signed_at: '2026-10-06T08:00:00Z',
    proposal_pdf_drive_id: 'drive_file_1',
  };

  it('the signed email has no portal link and says Zjak will be in touch', () => {
    const html = renderSignedClientEmail(d);
    expect(html).not.toContain('capucor.app');
    expect(html).not.toMatch(/portal|log ?in/i);
    expect(html).toContain('Zjak will be in touch');
    expect(html).not.toMatch(/our team|the Capucor team/i);
  });

  it('the client message says "signed" and goes to the address as signed', () => {
    const m = buildSignedClientMessage(proposal);
    expect(m.to).toBe('Pat@Example.com');
    expect(m.subject).toBe('Your Capucor proposal is signed');
    expect(m.replyTo).toBe('info@capucor.com');
    expect(m.html).not.toMatch(/portal|log ?in/i);
  });

  it('the owner message says "signed", carries the Drive link and no portal wording', () => {
    const m = buildSignedOwnerMessage(proposal, 'owner@capucor.com');
    expect(m.to).toBe('owner@capucor.com');
    expect(m.subject).toBe('Signed: Pat Trading Co (FT-2026-10-0001), set up billing');
    expect(m.html).toContain('Proposal signed');
    expect(m.html).toContain('https://drive.google.com/file/d/drive_file_1/view');
    expect(m.html).not.toMatch(/portal|provision|log ?in/i);
  });

  it('the owner message says so when the PDF is not in Drive', () => {
    const m = buildSignedOwnerMessage({ ...proposal, ref_number: null, proposal_pdf_drive_id: null }, 'owner@capucor.com');
    expect(m.subject).toBe('Signed: Pat Trading Co, set up billing');
    expect(m.html).not.toContain('drive.google.com');
    expect(m.html).toContain('not in Drive');
  });
});

describe('proposal email first-debit line (F23)', () => {
  it('states the rule and the date for signing in the month it was sent', () => {
    const html = renderCreatedProposalClientEmail({
      firstName: 'Pat',
      businessName: 'Pat Trading Co',
      tierName: 'Pro',
      refNumber: null,
      lineItems: [],
      totalChargeZAR: 0,
      proposalUrl: 'https://capucor.com/proposal/x',
      firstDebitFrom: '2026-10-28T08:00:00Z',
    });
    expect(html).toContain(
      'Your first debit order is on the 1st of the month after you sign: <strong>1 November 2026</strong> if you sign in October.',
    );
  });
});
