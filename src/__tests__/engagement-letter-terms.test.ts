import { describe, it, expect } from 'vitest';
import { renderProposalDocumentHtml } from '@/lib/proposal/renderProposalDocumentHtml';
import type { FairUsageLine } from '@/lib/schedule';
import {
  CAPUCOR_LEGAL,
  FEES_NOTES,
  INLINE_TERM_IDS,
  PAYROLL_ONLY_RESPONSIBILITIES_OURS,
  PAYROLL_ONLY_RESPONSIBILITIES_YOURS,
  PAYROLL_ONLY_TERMS,
  PROPOSAL_TERMS,
  RESPONSIBILITIES_OURS,
  RESPONSIBILITIES_YOURS,
  TERMS_VERSION,
} from '@/config/proposalTerms';
import { CORE_SERVICES } from '@/config/tiers';
import { siteConfig } from '@/config/site';

// The signed proposal is the engagement letter (owner's decisions of
// 2026-10-26). Each test pins one decision to the text a client signs.

const block = (id: string) => {
  const b = PROPOSAL_TERMS.find((t) => t.id === id);
  if (!b) throw new Error(`no terms block ${id}`);
  return b.paragraphs.join(' ');
};

const allTermsText = [
  ...PROPOSAL_TERMS.flatMap((b) => [b.heading, ...b.paragraphs]),
  ...PAYROLL_ONLY_TERMS.paragraphs,
  ...RESPONSIBILITIES_OURS,
  ...RESPONSIBILITIES_YOURS,
  ...PAYROLL_ONLY_RESPONSIBILITIES_OURS,
  ...PAYROLL_ONLY_RESPONSIBILITIES_YOURS,
  ...FEES_NOTES,
].join('\n');

function signed(over: Partial<Parameters<typeof renderProposalDocumentHtml>[0]> = {}) {
  return renderProposalDocumentHtml({
    clientLegalName: 'Pat Trading (Pty) Ltd',
    clientRegistrationNumber: '2021/123456/07',
    clientRegisteredAddress: '1 Main Road, Centurion, 0157',
    signerAuthorityConfirmed: true,
    termsVersion: TERMS_VERSION,
    businessName: 'Pat Trading Co',
    firstName: 'Pat',
    lastName: 'Patterson',
    tierName: 'Pro',
    tierSlug: 'pro',
    refNumber: 'FT-2026-11-0001',
    version: 1,
    sentAt: '2026-11-02T00:00:00.000Z',
    expiresAt: '2026-11-09T00:00:00.000Z',
    firstDebitFrom: '2026-11-02T00:00:00.000Z',
    signedAt: '2026-11-03T00:00:00.000Z',
    signatureName: 'Pat Patterson',
    signatureMethod: 'typed',
    signatureImage: null,
    signatureIp: null,
    inclusions: ['Core monthly financials'],
    fairUsage: [] as FairUsageLine[],
    outOfScope: [],
    lineItems: [{ name: 'Accounting', label: null, price: 1325 }],
    totalChargeZAR: 1325,
    ...over,
  });
}

describe('engagement letter terms (2026-10-26)', () => {
  it('names the contracting entity and the signer authority (rows 1, 3)', () => {
    expect(block('parties')).toContain('Capucor Holdings (Pty) Ltd, registration number 2014/144982/07, trading as Capucor Business Solutions');
    expect(block('parties')).toContain('authorised to sign for the business');
    expect(block('parties')).toContain('the proposal wins');
  });

  it('uses the FICA policy wording, not "required by law" (decision 1)', () => {
    expect(block('fica')).toBe(
      'Before we start, we verify who you are and who acts for you, using ID and registration documents. Like every business, we must report suspicious transactions to the Financial Intelligence Centre.',
    );
    expect(allTermsText).not.toMatch(/required by law/i);
  });

  it('keeps the "specific work" cap, adds the exception, and shows it inline (decision 2, CPA s49)', () => {
    expect(block('liability')).toContain('the fees you have paid us for the specific work the claim relates to');
    expect(block('liability')).toContain('does not apply to loss caused by our fraud, dishonesty or gross negligence');
    expect(INLINE_TERM_IDS).toContain('liability');
  });

  it('pauses after 30 days unpaid with 7 days notice, no interest; increases from 1 March (decisions 3, 4)', () => {
    const t = block('payment');
    expect(t).toContain('unpaid 30 days after its due date');
    expect(t).toContain('pause work 7 days after that notice');
    expect(t).toContain('We charge no interest');
    expect(t).toContain('once a year, from 1 March');
    expect(t).toContain("at least 30 days' written notice");
  });

  it('keeps approvals at "where we ask you to" (decision 5)', () => {
    expect(RESPONSIBILITIES_YOURS.join(' ')).toContain('where we ask you to');
  });

  it('states the AFS terms (decision 6)', () => {
    const t = block('afs');
    expect(t).toContain('under IFRS for SMEs, unless we agree another framework with you in writing');
    expect(t).toContain('for your owners, SARS, CIPC and your bank');
    expect(t).toContain('compilation report');
    expect(t).toContain('not audited or reviewed');
    expect(t).toContain('approve and sign them');
  });

  it('talks first, then court (decision 7)', () => {
    const t = block('jurisdiction');
    expect(t).toContain('within 10 business days');
    expect(t).toContain('within 20 business days');
    expect(t).toContain('Magistrate’s Court');
  });

  it('keeps records 5 years, then deletes them (decision 8)', () => {
    expect(block('ownership')).toContain('5 years after the end of the tax year');
    expect(block('ownership')).toContain('whichever is later');
    expect(block('ownership')).toContain('delete them securely');
  });

  it('has no hourly rate; out-of-scope work is quoted first (decision 9)', () => {
    expect(allTermsText).not.toMatch(/hourly/i);
    expect(block('changes')).toContain('We always quote it first');
  });

  it('records Capucor’s acceptance on the PDF, without a personal name (decision 10)', () => {
    const html = signed();
    expect(html).toContain('Accepted for Capucor Holdings (Pty) Ltd t/a Capucor Business Solutions');
    expect(html).toContain('subject to our identity checks');
    expect(html).toContain('decline within 10 business days');
    expect(html).not.toMatch(/Zjak|Pieterse/);
  });

  it('prints the legal entity, registration number, version and "the proposal wins" on the PDF (rows 1, 28, 30)', () => {
    const html = signed();
    expect(html.match(/2014\/144982\/07/g)?.length).toBeGreaterThanOrEqual(3); // header, footer, terms
    expect(html).toContain(`Terms version ${TERMS_VERSION}`);
    expect(html).toContain(`Engagement terms (version ${TERMS_VERSION})`);
    expect(html).toContain('the proposal wins');
    expect(html).toContain(CAPUCOR_LEGAL.address);
  });

  it('shows the client legal details, authority, start date and stored terms version (rows 2, 3, 15, 30)', () => {
    const html = signed();
    expect(html).toContain('Who this agreement is between');
    expect(html).toContain('Pat Trading (Pty) Ltd');
    expect(html).toContain('2021/123456/07');
    expect(html).toContain('1 Main Road, Centurion, 0157');
    expect(html).toContain('authorised to sign for Pat Trading (Pty) Ltd');
    expect(html).toContain('Start date</td><td style="padding:3px 0;">3 November 2026 (the day you signed)');
  });

  it('prints the version the client signed, not the live one', () => {
    const html = signed({ termsVersion: '2025.9' });
    expect(html).toContain('Engagement terms (version 2025.9)');
    expect(html).toContain('Terms version 2025.9');
    expect(html).toContain(`You signed terms version 2025.9. The text below is version ${TERMS_VERSION}`);
    expect(html).not.toContain(`Terms version ${TERMS_VERSION}`);
  });

  it('leaves out what an older signature never captured', () => {
    const html = signed({
      clientLegalName: null,
      clientRegistrationNumber: null,
      clientRegisteredAddress: null,
      signerAuthorityConfirmed: false,
      termsVersion: null,
    });
    expect(html).toContain('<p style="margin:24px 0 8px;font-size:13px;font-weight:700;color:#6b7280;">Engagement terms</p>');
    expect(html).not.toContain('Terms version');
    expect(html).not.toContain('Registration number</td>');
    expect(html).not.toContain('Authority</td>');
    expect(html).toContain('Pat Trading Co'); // falls back to the business name
  });

  it('carries the ECTA s44 cooling-off for individuals into the signed PDF', () => {
    expect(block('individuals')).toContain('cancel it within 7 days of signing');
    expect(block('individuals')).toContain('within 30 days of your cancellation');
    expect(signed()).toContain('If you sign as an individual');
  });

  it('labels the first payment, not a debit order: payments are by EFT for now', () => {
    const html = signed();
    expect(html).toContain('First payment due:</strong> 1 December 2026');
    expect(html).not.toContain('First debit order');
    expect(block('payment')).toContain('by EFT against our invoice, or by debit order once we have set one up with you');
  });

  it('defines the payroll cut-off from the salaries playbook (row 13)', () => {
    expect(PAYROLL_ONLY_RESPONSIBILITIES_YOURS.join(' ')).toContain('17:00, two business days before pay day');
    expect(allTermsText).not.toContain('agreed cut-off');
    expect(allTermsText).not.toContain('agreed cycle');
    expect(allTermsText).not.toContain('agreed day');
  });

  it('uses team@capucor.com as the one client-facing address', () => {
    expect(allTermsText).not.toMatch(/zjak@|info@/);
    expect(JSON.stringify(CORE_SERVICES)).not.toMatch(/zjak@|info@/);
    expect(siteConfig.email.contact).toBe('team@capucor.com');
    expect(siteConfig.email.replyTo).toBe('team@capucor.com');
  });

  it('has no em dash in any clause (voice-and-copy: banned in proposal and PDF prose)', () => {
    expect(allTermsText).not.toContain('—');
  });
});
