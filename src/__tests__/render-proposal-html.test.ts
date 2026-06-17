import { describe, it, expect } from 'vitest';
import { renderProposalDocumentHtml } from '@/lib/proposal/renderProposalDocumentHtml';
import type { FairUsageLine } from '@/lib/schedule';
import { formatZAR } from '@/lib/utils';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function sampleData(overrides: Record<string, unknown> = {}) {
  return {
    businessName: 'Pat Trading Co',
    firstName: 'Pat',
    lastName: 'Patterson',
    refNumber: 'FT-2026-06-0042',
    version: 1,
    sentAt: '2026-06-01T00:00:00.000Z',
    expiresAt: '2026-07-01T00:00:00.000Z',
    signedAt: '2026-06-17T00:00:00.000Z',
    signatureName: 'Pat Patterson',
    signatureMethod: 'typed',
    signatureImage: PNG,
    signatureIp: '203.0.113.1',
    inclusions: ['Core monthly financials', 'SARS & CIPC compliance'],
    fairUsage: [
      {
        slug: 'accounting',
        name: 'Accounting',
        allowance: 'Up to 50 transactions a month',
        overage: 'R200 per 25 extra transactions',
        bracketLabel: 'R0–1 Mil',
      },
    ] as unknown as FairUsageLine[],
    outOfScope: ['Payroll (not part of this plan)', 'SARS audits'],
    lineItems: [{ name: 'Accounting', label: 'R0–1 Mil', price: 1325 }],
    totalChargeZAR: 1325,
    ...overrides,
  };
}

describe('renderProposalDocumentHtml', () => {
  it('includes the reference, totals, schedule, full terms, and the signature', () => {
    const html = renderProposalDocumentHtml(sampleData());

    expect(html).toContain('FT-2026-06-0042');
    expect(html).toContain('Pat Trading Co');
    expect(html).toContain('Core monthly financials'); // an included line
    expect(html).toContain('SARS audits'); // an out-of-scope line
    expect(html).toContain('Total monthly charge');
    expect(html).toContain(formatZAR(1325));
    expect(html).toContain('Debit-order authorisation'); // full PROPOSAL_TERMS inline
    expect(html).toContain('Pat Patterson'); // signature name
    expect(html).toContain('203.0.113.1'); // signature IP
    expect(html).toContain(PNG); // signature image embedded
  });

  it('renders gracefully without a signature image', () => {
    const html = renderProposalDocumentHtml(sampleData({ signatureImage: null }));
    expect(html).not.toContain('data:image/png');
    expect(html).toContain('Accepted and signed');
  });
});
