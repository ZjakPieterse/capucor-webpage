/**
 * Standalone HTML render of a SIGNED proposal, for PDF archival (PR10).
 *
 * This is the legal record of what the client signed, so it is self-contained:
 * the full engagement terms inline (not the web page's curated subset) plus the
 * executed signature block. It is deliberately simple, inline-styled, table-based
 * HTML — Apps Script's HTML→PDF converter handles that well, where it would choke
 * on the Tailwind/grid markup of the live /proposal/<token> page. Content is
 * sourced from the same config + helpers the web document uses, so the wording
 * matches what was shown.
 */

import type { FairUsageLine } from '@/lib/schedule';
import {
  CAPUCOR_LEGAL,
  TERMS_VERSION,
  feesNotesFor,
  proposalTermsFor,
  responsibilitiesFor,
} from '@/config/proposalTerms';
import { ALLOWANCE_CHANGE_NOTE } from '@/config/serviceScope';
import { CAPUCOR_LOGO_LIGHT_DATA_URL } from '@/lib/proposal/capucorLogo';
import { formatZAR, firstPaymentDue } from '@/lib/utils';

export interface ProposalDocumentData {
  businessName: string;
  firstName: string;
  lastName: string;
  tierName: string;
  /** The package slug; picks the payroll-only responsibilities. Generic when omitted. */
  tierSlug?: string;
  refNumber: string | null;
  version: number;
  sentAt: string | null;
  expiresAt: string | null;
  /** Stable proposal timestamp used to calculate the first debit month. */
  firstDebitFrom: string | null;
  /** A plan review's start date (004); the first payment when still ahead. */
  effectiveFrom?: string | null;
  signedAt: string | null;
  /** Who is bound and on which terms, as captured with the signature (005). */
  clientLegalName?: string | null;
  clientRegistrationNumber?: string | null;
  clientRegisteredAddress?: string | null;
  signerAuthorityConfirmed?: boolean;
  /** The terms version the client signed; null on signatures before 005. */
  termsVersion?: string | null;
  signatureName: string | null;
  signatureMethod: string | null;
  signatureImage: string | null; // normalised PNG data URL
  signatureIp: string | null;
  inclusions: string[];
  fairUsage: FairUsageLine[];
  outOfScope: string[];
  lineItems: { name: string; label: string | null; price: number }[];
  totalChargeZAR: number;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Dates read in South African time, whatever the renderer's own zone.
function dateZA(iso: string | null, timeZone = 'Africa/Johannesburg'): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone,
  });
}

const LABEL =
  'margin:24px 0 8px;font-size:13px;font-weight:700;color:#6b7280;';
const SUBHEAD =
  'margin:14px 0 6px;font-size:13px;font-weight:600;color:#111827;';
const PARA = 'margin:0 0 8px;font-size:13px;line-height:1.6;color:#374151;';
const LI = 'margin:0 0 5px;font-size:13px;line-height:1.5;color:#374151;';

// Brand v1.1 light palette (Zjak, 2026-10-17): Capucor Navy, the logo's own navy, for
// accent lines and headings on white, with a light navy tint for the signature box.
// The cyan washes out on white, so it is never used for text here. Neutral greys stay.
const BRAND_NAVY = '#00175f';
const SIG_BG = '#eef3fb';
const SIG_BORDER = '#c9d6ee';

// The contracting party (decision 10, 2026-10-26): named in the header, the
// acceptance block and the footer. No personal name.
const LEGAL_ENTITY = `${CAPUCOR_LEGAL.name} t/a ${CAPUCOR_LEGAL.tradingAs}`;

function list(items: string[]): string {
  if (items.length === 0) return '';
  return `<ul style="margin:0 0 8px;padding-left:18px;">${items
    .map((t) => `<li style="${LI}">${escapeHtml(t)}</li>`)
    .join('')}</ul>`;
}

export function renderProposalDocumentHtml(d: ProposalDocumentData): string {
  const fullName = `${d.firstName} ${d.lastName}`.trim();
  const clientName = d.clientLegalName ?? d.businessName;

  // One anchor (gap row 15): the signing day, through the helper the proposal
  // page uses, so both show the same date for the same day.
  const firstPayment = firstPaymentDue(
    d.firstDebitFrom ? new Date(d.firstDebitFrom) : undefined,
    d.effectiveFrom,
  ).toISOString();

  // The version the client signed, never the live constant. The text below is
  // rendered from the live terms, so say so if the two ever differ (a re-render
  // after a terms change).
  const termsLabel = d.termsVersion ? `Engagement terms (version ${escapeHtml(d.termsVersion)})` : 'Engagement terms';
  const termsMismatch =
    d.termsVersion && d.termsVersion !== TERMS_VERSION
      ? `<p style="${PARA}">You signed terms version ${escapeHtml(d.termsVersion)}. The text below is version ${escapeHtml(TERMS_VERSION)}; the version you signed is on our record.</p>`
      : '';

  const legalRows = [
    `<tr><td style="padding:3px 0;color:#6b7280;width:150px;">Client</td><td style="padding:3px 0;">${escapeHtml(clientName)}</td></tr>`,
    d.clientRegistrationNumber
      ? `<tr><td style="padding:3px 0;color:#6b7280;">Registration number</td><td style="padding:3px 0;">${escapeHtml(d.clientRegistrationNumber)}</td></tr>`
      : '',
    d.clientRegisteredAddress
      ? `<tr><td style="padding:3px 0;color:#6b7280;">Registered address</td><td style="padding:3px 0;">${escapeHtml(d.clientRegisteredAddress)}</td></tr>`
      : '',
    `<tr><td style="padding:3px 0;color:#6b7280;">Service provider</td><td style="padding:3px 0;">${escapeHtml(LEGAL_ENTITY)}, registration number ${escapeHtml(CAPUCOR_LEGAL.registrationNumber)}, ${escapeHtml(CAPUCOR_LEGAL.address)}</td></tr>`,
    d.signedAt
      ? `<tr><td style="padding:3px 0;color:#6b7280;">Start date</td><td style="padding:3px 0;">${dateZA(d.signedAt)} (the day you signed)</td></tr>`
      : '',
  ].join('');

  const feeRows = d.lineItems
    .map(
      (li) =>
        `<tr>
          <td style="padding:6px 0;border-bottom:1px solid #eef0f2;font-size:13px;color:#374151;">${escapeHtml(li.name)}${
            li.label
              ? ` <span style="color:#6b7280;">· ${escapeHtml(li.label)}</span>`
              : ''
          }</td>
          <td style="padding:6px 0;border-bottom:1px solid #eef0f2;font-size:13px;color:#374151;text-align:right;white-space:nowrap;">${formatZAR(li.price)}</td>
        </tr>`,
    )
    .join('');

  const allowanceRows = d.fairUsage
    .map(
      (f) =>
        `<li style="${LI}"><strong style="color:#111827;">${escapeHtml(f.name)}</strong>${
          f.bracketLabel ? ` — ${escapeHtml(f.bracketLabel)}` : ''
        }<br/><span style="color:#6b7280;">${escapeHtml(f.allowance)}</span></li>`,
    )
    .join('');

  const termsHtml = proposalTermsFor(d.tierSlug ?? '').map(
    (b) =>
      `<div style="margin:0 0 12px;">
        <p style="${SUBHEAD}">${escapeHtml(b.heading)}</p>
        ${b.paragraphs.map((p) => `<p style="${PARA}">${escapeHtml(p)}</p>`).join('')}
      </div>`,
  ).join('');

  const signatureBlock = `
    <div style="margin-top:8px;border:1px solid ${SIG_BORDER};background:${SIG_BG};border-radius:10px;padding:16px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:${BRAND_NAVY};">Accepted and signed</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151;">
        <tr><td style="padding:3px 0;color:#6b7280;width:120px;">Signed by</td><td style="padding:3px 0;">${escapeHtml(d.signatureName ?? fullName)}</td></tr>
        <tr><td style="padding:3px 0;color:#6b7280;">For</td><td style="padding:3px 0;">${escapeHtml(clientName)}</td></tr>
        ${d.signerAuthorityConfirmed ? `<tr><td style="padding:3px 0;color:#6b7280;">Authority</td><td style="padding:3px 0;">Confirmed by the signer: authorised to sign for ${escapeHtml(clientName)}</td></tr>` : ''}
        <tr><td style="padding:3px 0;color:#6b7280;">Date</td><td style="padding:3px 0;">${dateZA(d.signedAt)}</td></tr>
        ${d.termsVersion ? `<tr><td style="padding:3px 0;color:#6b7280;">Terms version</td><td style="padding:3px 0;">${escapeHtml(d.termsVersion)}</td></tr>` : ''}
        ${d.signatureMethod ? `<tr><td style="padding:3px 0;color:#6b7280;">Method</td><td style="padding:3px 0;">${escapeHtml(d.signatureMethod)}</td></tr>` : ''}
        ${d.signatureIp ? `<tr><td style="padding:3px 0;color:#6b7280;">IP address</td><td style="padding:3px 0;">${escapeHtml(d.signatureIp)}</td></tr>` : ''}
      </table>
      ${
        d.signatureImage
          ? `<div style="margin-top:12px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:10px;text-align:center;">
               <img src="${d.signatureImage}" alt="Signature" style="max-height:90px;max-width:100%;" />
             </div>`
          : ''
      }
    </div>
    <div style="margin-top:12px;border:1px solid ${SIG_BORDER};background:${SIG_BG};border-radius:10px;padding:16px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:${BRAND_NAVY};">Accepted for ${escapeHtml(LEGAL_ENTITY)}</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151;">
        <tr><td style="padding:3px 0;color:#6b7280;width:120px;">Date</td><td style="padding:3px 0;">${dateZA(d.signedAt)}</td></tr>
      </table>
      <p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:#6b7280;">Accepted when you signed, subject to our identity checks. If those checks are not met, we may decline within 10 business days of your signature and will tell you in writing.</p>
    </div>`;

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /></head>
<body style="margin:0;font-family:Helvetica,Arial,sans-serif;color:#111827;">
  <div style="max-width:680px;margin:0 auto;padding:28px;">

    <!-- Header -->
    <div style="border-bottom:2px solid ${BRAND_NAVY};padding-bottom:14px;margin-bottom:6px;">
      <img src="${CAPUCOR_LOGO_LIGHT_DATA_URL}" alt="Capucor Business Solutions" style="height:38px;width:auto;display:block;" />
      <p style="${LABEL}margin-top:12px;">Proposal &amp; engagement</p>
      <h1 style="margin:2px 0 4px;font-size:22px;color:#111827;">For ${escapeHtml(d.businessName)}</h1>
      <p style="margin:0;font-size:13px;color:#6b7280;">Prepared for ${escapeHtml(fullName)}, by ${escapeHtml(LEGAL_ENTITY)} (registration number ${escapeHtml(CAPUCOR_LEGAL.registrationNumber)})</p>
      <p style="margin:10px 0 0;"><span style="display:inline-block;background:${SIG_BG};border:1px solid ${SIG_BORDER};border-radius:6px;padding:4px 10px;font-size:12px;font-weight:700;color:${BRAND_NAVY};">${escapeHtml(d.tierName)} package</span></p>
      <p style="margin:8px 0 0;font-size:12px;color:#6b7280;">
        ${d.refNumber ? `Reference ${escapeHtml(d.refNumber)}${d.version > 1 ? ` · Revision ${d.version}` : ''} &nbsp;·&nbsp; ` : ''}
        ${d.sentAt ? `Prepared ${dateZA(d.sentAt)}` : ''}${d.signedAt ? ` &nbsp;·&nbsp; Signed ${dateZA(d.signedAt)}` : ''}
      </p>
    </div>

    <p style="${PARA}margin-top:14px;">Hi ${escapeHtml(d.firstName)}, this sets out everything we&#39;ll do for ${escapeHtml(
      d.businessName,
    )}, what it costs, and the terms you accepted by signing.</p>

    <!-- Parties -->
    <p style="${LABEL}">Who this agreement is between</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151;">${legalRows}</table>

    <!-- Schedule of services -->
    <p style="${LABEL}">Schedule of services</p>
    <p style="${SUBHEAD}">What&#39;s included</p>
    ${list(d.inclusions)}
    ${allowanceRows ? `<p style="${SUBHEAD}">Your allowances</p><ul style="margin:0 0 8px;padding-left:18px;">${allowanceRows}</ul><p style="${PARA}">${escapeHtml(ALLOWANCE_CHANGE_NOTE)}</p>` : ''}
    <p style="${SUBHEAD}">What&#39;s not included</p>
    ${list(d.outOfScope)}

    <!-- Fees -->
    <p style="${LABEL}">Your fees</p>
    <p style="${SUBHEAD}">Package: ${escapeHtml(d.tierName)}</p>
    <table style="width:100%;border-collapse:collapse;">
      ${feeRows}
      <tr>
        <td style="padding:8px 0;font-size:14px;font-weight:700;color:#111827;">Total monthly charge</td>
        <td style="padding:8px 0;font-size:14px;font-weight:700;color:#111827;text-align:right;white-space:nowrap;">${formatZAR(d.totalChargeZAR)}</td>
      </tr>
    </table>
    <ul style="margin:8px 0 0;padding-left:18px;">${feesNotesFor(d.tierSlug ?? '').map((n) => `<li style="${LI}color:#6b7280;">${escapeHtml(n)}</li>`).join('')}</ul>
    <p style="${PARA}margin-top:8px;"><strong style="color:#111827;">First payment due:</strong> ${dateZA(firstPayment, 'UTC')}</p>

    <!-- Fee fairness -->
    <p style="${LABEL}">How your fee stays fair</p>
    <p style="${PARA}">We review your engagement every quarter against your rolling average over the last 3 to 12 months. One busy month won&#39;t move your price and a quiet one won&#39;t count against you. Any change applies from the next billing cycle and is never back-dated.</p>

    <!-- Responsibilities -->
    <p style="${LABEL}">What each of us does</p>
    <p style="${SUBHEAD}">We&#39;ll</p>
    ${list(responsibilitiesFor(d.tierSlug ?? '').ours)}
    <p style="${SUBHEAD}">You&#39;ll</p>
    ${list(responsibilitiesFor(d.tierSlug ?? '').yours)}

    <!-- Full terms -->
    <p style="${LABEL}">${termsLabel}</p>
    <p style="${PARA}">This proposal and the terms below are the engagement letter between us. If anything in the terms conflicts with the proposal, the proposal wins.</p>
    ${termsMismatch}
    ${termsHtml}

    <!-- Signature -->
    <p style="${LABEL}">Signature</p>
    ${signatureBlock}

    <p style="margin:24px 0 0;font-size:11px;color:#6b7280;text-align:center;">
      ${escapeHtml(LEGAL_ENTITY)} · Reg. ${escapeHtml(CAPUCOR_LEGAL.registrationNumber)}<br/>
      ${escapeHtml(CAPUCOR_LEGAL.address)} · ${escapeHtml(CAPUCOR_LEGAL.email)} · capucor.com${d.termsVersion ? ` · Terms version ${escapeHtml(d.termsVersion)}` : ''}
    </p>
  </div>
</body>
</html>`;
}
