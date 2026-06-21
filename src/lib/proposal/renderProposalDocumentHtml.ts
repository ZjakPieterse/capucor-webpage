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
  FEES_NOTES,
  PROPOSAL_TERMS,
  RESPONSIBILITIES_OURS,
  RESPONSIBILITIES_YOURS,
} from '@/config/proposalTerms';
import { CAPUCOR_LOGO_LIGHT_DATA_URL } from '@/lib/proposal/capucorLogo';
import { formatZAR } from '@/lib/utils';

export interface ProposalDocumentData {
  businessName: string;
  firstName: string;
  lastName: string;
  refNumber: string | null;
  version: number;
  sentAt: string | null;
  expiresAt: string | null;
  signedAt: string | null;
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

function dateZA(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const LABEL =
  'margin:24px 0 8px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;';
const SUBHEAD = 'margin:14px 0 6px;font-size:13px;font-weight:600;color:#111827;';
const PARA = 'margin:0 0 8px;font-size:13px;line-height:1.6;color:#374151;';
const LI = 'margin:0 0 5px;font-size:13px;line-height:1.5;color:#374151;';

// Brand accent colours (mirror the globals.css --brand-* tokens), tuned for the
// PDF's white background: navy for accent lines + headings — legible on white and
// the colour of the logo wordmark — with a light navy tint for the signature box.
// The site's bright cyan primary is built for the dark web theme and washes out on
// white, so it isn't used here. Neutral greys (text/borders) stay as-is.
const BRAND_NAVY = '#1e3a8a';
const SIG_BG = '#eff6ff';
const SIG_BORDER = '#c7d7f5';

function list(items: string[]): string {
  if (items.length === 0) return '';
  return `<ul style="margin:0 0 8px;padding-left:18px;">${items
    .map((t) => `<li style="${LI}">${escapeHtml(t)}</li>`)
    .join('')}</ul>`;
}

export function renderProposalDocumentHtml(d: ProposalDocumentData): string {
  const fullName = `${d.firstName} ${d.lastName}`.trim();

  const feeRows = d.lineItems
    .map(
      (li) =>
        `<tr>
          <td style="padding:6px 0;border-bottom:1px solid #eef0f2;font-size:13px;color:#374151;">${escapeHtml(li.name)}${
            li.label ? ` <span style="color:#6b7280;">· ${escapeHtml(li.label)}</span>` : ''
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

  const overages = d.fairUsage.filter((f) => f.overage);
  const overageRows = overages
    .map(
      (f) =>
        `<li style="${LI}"><strong style="color:#111827;">${escapeHtml(f.name)}:</strong> ${escapeHtml(
          f.overage!,
        )}</li>`,
    )
    .join('');

  const termsHtml = PROPOSAL_TERMS.map(
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
        <tr><td style="padding:3px 0;color:#6b7280;">Date</td><td style="padding:3px 0;">${dateZA(d.signedAt)}</td></tr>
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
      <p style="margin:0;font-size:13px;color:#6b7280;">Prepared for ${escapeHtml(fullName)}, by Capucor Business Solutions</p>
      <p style="margin:8px 0 0;font-size:12px;color:#6b7280;">
        ${d.refNumber ? `Reference ${escapeHtml(d.refNumber)}${d.version > 1 ? ` · Revision ${d.version}` : ''} &nbsp;·&nbsp; ` : ''}
        ${d.sentAt ? `Prepared ${dateZA(d.sentAt)}` : ''}${d.signedAt ? ` &nbsp;·&nbsp; Signed ${dateZA(d.signedAt)}` : ''}
      </p>
    </div>

    <p style="${PARA}margin-top:14px;">Hi ${escapeHtml(d.firstName)}, this sets out everything we&#39;ll do for ${escapeHtml(
      d.businessName,
    )}, what it costs, and the terms you accepted by signing.</p>

    <!-- Schedule of services -->
    <p style="${LABEL}">Schedule of services</p>
    <p style="${SUBHEAD}">What&#39;s included</p>
    ${list(d.inclusions)}
    ${allowanceRows ? `<p style="${SUBHEAD}">Your allowances</p><ul style="margin:0 0 8px;padding-left:18px;">${allowanceRows}</ul>` : ''}
    <p style="${SUBHEAD}">What&#39;s not included</p>
    ${list(d.outOfScope)}

    <!-- Fees -->
    <p style="${LABEL}">Your fees</p>
    <table style="width:100%;border-collapse:collapse;">
      ${feeRows}
      <tr>
        <td style="padding:8px 0;font-size:14px;font-weight:700;color:#111827;">Total monthly charge</td>
        <td style="padding:8px 0;font-size:14px;font-weight:700;color:#111827;text-align:right;white-space:nowrap;">${formatZAR(d.totalChargeZAR)}</td>
      </tr>
    </table>
    <ul style="margin:8px 0 0;padding-left:18px;">${FEES_NOTES.map((n) => `<li style="${LI}color:#6b7280;">${escapeHtml(n)}</li>`).join('')}</ul>

    <!-- Fee fairness -->
    <p style="${LABEL}">How your fee stays fair</p>
    <p style="${PARA}">We review your engagement every quarter against your rolling average over the last 3 to 12 months. One busy month won&#39;t move your price and a quiet one won&#39;t count against you. Any change applies from the next billing cycle and is never back-dated.</p>
    ${overageRows ? `<ul style="margin:0 0 8px;padding-left:18px;">${overageRows}</ul>` : ''}

    <!-- Responsibilities -->
    <p style="${LABEL}">What each of us does</p>
    <p style="${SUBHEAD}">We&#39;ll</p>
    ${list(RESPONSIBILITIES_OURS)}
    <p style="${SUBHEAD}">You&#39;ll</p>
    ${list(RESPONSIBILITIES_YOURS)}

    <!-- Full terms -->
    <p style="${LABEL}">Engagement terms</p>
    ${termsHtml}

    <!-- Signature -->
    <p style="${LABEL}">Signature</p>
    ${signatureBlock}

    <p style="margin:24px 0 0;font-size:11px;color:#9ca3af;text-align:center;">
      Capucor Business Solutions · Outsourced finance for growing SMEs
    </p>
  </div>
</body>
</html>`;
}
