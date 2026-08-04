import { describe, it, expect } from 'vitest';
import { renderProposalDocumentHtml } from '@/lib/proposal/renderProposalDocumentHtml';
import type { FairUsageLine } from '@/lib/schedule';
import { formatZAR, firstOfNextMonth } from '@/lib/utils';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function sampleData(overrides: Record<string, unknown> = {}) {
  return {
    businessName: 'Pat Trading Co',
    firstName: 'Pat',
    lastName: 'Patterson',
    tierName: 'Pro',
    refNumber: 'FT-2026-06-0042',
    version: 1,
    sentAt: '2026-06-01T00:00:00.000Z',
    expiresAt: '2026-07-01T00:00:00.000Z',
    firstDebitFrom: '2026-06-01T00:00:00.000Z',
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

  it('surfaces the chosen package name in the header and the fees section', () => {
    const html = renderProposalDocumentHtml(sampleData());
    expect(html).toContain('Pro package'); // header badge near the top
    expect(html).toContain('Package: Pro'); // fees section line

    // The header badge sits above the fees line.
    expect(html.indexOf('Pro package')).toBeLessThan(
      html.indexOf('Package: Pro'),
    );
  });

  it('states the stable first debit order date from the proposal timestamp', () => {
    const html = renderProposalDocumentHtml(sampleData());
    const expected = firstOfNextMonth(
      new Date('2026-06-01T00:00:00.000Z'),
    ).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    expect(html).toContain('First debit order:');
    expect(html).toContain(expected);
  });

  it('renders gracefully without a signature image', () => {
    const html = renderProposalDocumentHtml(
      sampleData({ signatureImage: null }),
    );
    // The signature image is absent, but the header logo is always an inline
    // data: URL (the Apps Script PDF converter can't fetch remote images), so
    // assert specifically that the signature PNG isn't embedded.
    expect(html).not.toContain(PNG);
    expect(html).toContain('Accepted and signed');
  });

  it('embeds the Capucor logo inline (data URL) so the PDF converter can render it', () => {
    const html = renderProposalDocumentHtml(sampleData());
    expect(html).toContain('data:image/png;base64,');
    expect(html).toContain('alt="Capucor Business Solutions"');
    // Never a remote image URL — the converter only renders inline data: images.
    // Deliberately domain-agnostic: this used to assert against a hardcoded
    // https://capucor.app/brand/ prefix, which would have gone silently green
    // the moment the site moved to capucor.com. Match any remote <img> instead.
    expect(html).not.toMatch(/<img[^>]+src=["']https?:\/\//i);
  });
});
