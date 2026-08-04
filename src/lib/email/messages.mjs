/**
 * Dependency-free transactional email renderers shared by the applications
 * and the GitHub reconciliation runner. Keep the copy in capucor-web byte-for-
 * byte identical; CI checks this contract. No secrets or delivery state live
 * here, so a queued event can be rebuilt from its source row.
 */

export const EMAIL_SENDER = 'Capucor <noreply@capucor.com>';
export const WEBSITE_SENDER = 'Capucor Website <noreply@capucor.com>';
export const PRIVACY_SENDER = 'Capucor Privacy <noreply@capucor.com>';
export const EMAIL_REPLY_TO = 'info@capucor.com';

const zarWhole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const zarDecimal = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatZAR(amount) {
  const clean = Math.round(Number(amount) * 100) / 100;
  return `R ${clean % 1 === 0 ? zarWhole.format(clean) : zarDecimal.format(clean)}`;
}

export function stableStringify(value) {
  const normalize = (entry) => {
    if (Array.isArray(entry)) return entry.map(normalize);
    if (entry && typeof entry === 'object') {
      return Object.fromEntries(
        Object.entries(entry)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, nested]) => [key, normalize(nested)]),
      );
    }
    return entry;
  };
  return JSON.stringify(normalize(value), null, 2);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatSast(iso) {
  return new Date(iso).toLocaleString('en-ZA', {
    timeZone: 'Africa/Johannesburg',
  });
}

function firstOfNextMonth(iso) {
  const from = new Date(iso);
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
}

function clientShell(content, footer = true) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:32px;">
      ${content}
    </div>${
      footer
        ? `
    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
      Capucor Business Solutions · Outsourced finance for growing SMEs
    </p>`
        : ''
    }
  </div>
</body>
</html>`;
}

function brand() {
  return '<p style="margin:0 0 24px;font-weight:700;font-size:18px;letter-spacing:-0.01em;color:#0f766e;">Capucor</p>';
}

function reference(refNumber) {
  return refNumber
    ? `<p style="margin:0 0 8px;font-size:12px;color:#6b7280;">Reference ${escapeHtml(refNumber)}</p>`
    : '';
}

function button(href, label, inline = false) {
  return `<a href="${href}" style="display:${inline ? 'inline-block' : 'block'};margin:${inline ? '24px 0 0' : '24px 0 8px'};background:#0f766e;color:#ffffff;text-decoration:none;text-align:center;font-weight:600;font-size:${inline ? '14px' : '15px'};padding:${inline ? '12px 22px' : '14px 20px'};border-radius:10px;">${label}</a>`;
}

export function renderLeadOwnerText(d) {
  return [
    `Source: ${d.source}`,
    `Name: ${d.name}`,
    `Email: ${d.email}`,
    d.business ? `Business: ${d.business}` : null,
    d.phone ? `Phone: ${d.phone}` : null,
    d.message ? `\nMessage:\n${d.message}` : null,
    d.config ? `\nConfig:\n${stableStringify(d.config)}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function renderDataRequestConfirmationText(d) {
  return [
    'Hi,',
    '',
    `We received a POPIA ${d.requestType === 'delete' ? 'deletion' : 'access'} request for this email address from the Capucor website.`,
    '',
    `To confirm it was you, please click the link below within ${d.tokenTtlHours} hours:`,
    '',
    d.confirmUrl,
    '',
    `Once confirmed, we will respond within ${d.slaDays} days.`,
    '',
    'If you did not make this request, you can safely ignore this email. No action will be taken without confirmation.',
    '',
    'Thanks,',
    'Capucor Business Solutions',
  ].join('\n');
}

export function renderDataRequestPendingOwnerText(d) {
  return [
    `A new POPIA ${d.requestType} request was submitted.`,
    '',
    `Email: ${d.email}`,
    `Type: ${d.requestType}`,
    `IP: ${d.ipAddress ?? 'unknown'}`,
    `Status: pending_confirmation (${d.tokenTtlHours}h)`,
    `Requester email: ${d.requesterDeliveryStatus}`,
    '',
    d.requesterDeliveryStatus === 'accepted'
      ? "The provider accepted the requester's confirmation email. You will be notified again once they confirm."
      : "The requester's confirmation email is pending and retained for retry. Check the delivery queue if it remains pending.",
  ].join('\n');
}

export function renderDataRequestConfirmedOwnerText(d) {
  const respondBy = new Date(new Date(d.confirmedAt).getTime() + d.slaDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return [
    `A POPIA ${d.requestType} request has been confirmed and is ready to action.`,
    '',
    `Email: ${d.email}`,
    `Type: ${d.requestType}`,
    `Respond by: ${respondBy}`,
    '',
    'Mark the row as processed once complete.',
  ].join('\n');
}

export function renderCreatedProposalClientEmail(d) {
  const firstDebitDate = firstOfNextMonth(d.firstDebitFrom).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const rows = d.lineItems
    .map(
      (line) => `
      <tr>
        <td style="padding:8px 0;color:#1f2937;font-size:14px;">${escapeHtml(line.name)}${
          line.label ? `<span style="color:#6b7280;"> · ${escapeHtml(line.label)}</span>` : ''
        }</td>
        <td style="padding:8px 0;text-align:right;color:#1f2937;font-size:14px;white-space:nowrap;">${formatZAR(line.price)}</td>
      </tr>`,
    )
    .join('');
  return clientShell(`${brand()}
      ${reference(d.refNumber)}
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#111827;">Hi ${escapeHtml(d.firstName)}, here&rsquo;s your proposal</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4b5563;">
        Thanks for configuring a plan for <strong>${escapeHtml(d.businessName)}</strong>. Below is a summary
        of your ${escapeHtml(d.tierName)} subscription. Open your proposal to review the full details and
        sign electronically. There&rsquo;s no payment required to get started.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 8px;">${rows}
      </table>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #e5e7eb;margin-top:8px;padding-top:8px;">
        <tr><td style="padding:8px 0;color:#111827;font-size:16px;font-weight:700;">Total monthly charge</td><td style="padding:8px 0;text-align:right;color:#111827;font-size:16px;font-weight:700;">${formatZAR(d.totalChargeZAR)}</td></tr>
      </table>
      <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#4b5563;">Your first debit order will be on <strong>${firstDebitDate}</strong>.</p>
      ${button(d.proposalUrl, 'View &amp; sign your proposal')}
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-align:center;">Billed monthly in advance · cancel any time with 30 days&rsquo; notice</p>
      <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;text-align:center;">This proposal link is valid for 7 days.</p>`);
}

export function renderCreatedProposalOwnerText(d) {
  return [
    'A new proposal was generated from the pricing calculator.',
    '',
    `Reference: ${d.refNumber ?? '(pending)'}`,
    `Name: ${d.fullName}`,
    `Business: ${d.businessName}`,
    `Email: ${d.email}`,
    `Package: ${d.tierName}`,
    `Client email: ${d.clientDeliveryStatus}`,
    ...d.lineItems.map((line) => `  · ${line.name}${line.label ? ` (${line.label})` : ''}: ${formatZAR(line.price)}`),
    '',
    `Total monthly charge: ${formatZAR(d.totalChargeZAR)}`,
    '',
    `Proposal link: ${d.proposalUrl}`,
  ].join('\n');
}

export function renderSignConfirmEmail(d) {
  return clientShell(`${brand()}
      ${reference(d.refNumber)}
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#111827;">One more step to sign, ${escapeHtml(d.firstName)}</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">We received a signature for the Capucor proposal for <strong>${escapeHtml(d.businessName)}</strong>. To finalise it, confirm from this email. That&rsquo;s how we check the signature came from you.</p>
      ${button(d.confirmUrl, 'Confirm &amp; sign')}
      <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#6b7280;text-align:center;">This link works once and expires in 30 minutes.</p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">If you didn&rsquo;t request this, ignore this email. Nothing is signed until you confirm.</p>`);
}

function signedAlertBlock(businessName, signedAt) {
  return `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:16px;">This proposal for <strong>${escapeHtml(businessName)}</strong> was signed on ${escapeHtml(formatSast(signedAt))} (SAST). If this wasn&rsquo;t you, reply to this email right away.</p>`;
}

export function renderProvisionedClientEmail(d) {
  return clientShell(`${brand()}
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#111827;">Your portal is ready, ${escapeHtml(d.firstName)}</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">We&rsquo;ve recorded your acceptance of the Capucor proposal for <strong>${escapeHtml(d.businessName)}</strong> and set up your client portal. You can sign in any time to see your plan, key dates and documents.</p>
      ${button(d.loginUrl, 'Sign in to your portal')}
      <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#6b7280;text-align:center;">Use this email address to sign in. No password needed.</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">Someone from our team will be in touch shortly to set up your onboarding and get your first month underway. Questions in the meantime? Just reply to this email.</p>
      ${signedAlertBlock(d.businessName, d.signedAt)}`);
}

export function renderSignedClientEmail(d) {
  return clientShell(`${brand()}
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#111827;">That&rsquo;s signed, ${escapeHtml(d.firstName)}</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">We&rsquo;ve recorded your acceptance of the Capucor proposal for <strong>${escapeHtml(d.businessName)}</strong>. There&rsquo;s nothing more you need to do right now.</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">Someone from our team will be in touch shortly to set up your onboarding and get your first month underway.</p>
      ${signedAlertBlock(d.businessName, d.signedAt)}`);
}

function ownerShell(content, failed = false) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /></head>
<body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#ffffff;border:1px solid ${failed ? '#f5c2c7' : '#e5e7eb'};border-radius:16px;padding:28px;">${content}
    </div>
  </div>
</body>
</html>`;
}

function ownerDetails(d) {
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;color:#1f2937;">
        ${d.refNumber ? `<tr><td style="padding:4px 0;color:#6b7280;">Reference</td><td style="padding:4px 0;text-align:right;">${escapeHtml(d.refNumber)}</td></tr>` : ''}
        <tr><td style="padding:4px 0;color:#6b7280;">Business</td><td style="padding:4px 0;text-align:right;">${escapeHtml(d.businessName)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Signed by</td><td style="padding:4px 0;text-align:right;">${escapeHtml(d.fullName)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Email</td><td style="padding:4px 0;text-align:right;">${escapeHtml(d.email)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">When</td><td style="padding:4px 0;text-align:right;">${escapeHtml(formatSast(d.signedAt))}</td></tr>
      </table>`;
}

export function renderProvisionedOwnerEmail(d) {
  return ownerShell(`
      <h1 style="margin:0 0 8px;font-size:18px;color:#111827;">Proposal signed, portal provisioned</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">${escapeHtml(d.businessName)} has signed. The portal org, membership and subscription are set up. To start billing:</p>
      <ol style="margin:0 0 20px;padding-left:18px;font-size:14px;line-height:1.7;color:#1f2937;">
        <li>Create the Xero contact for ${escapeHtml(d.businessName)} and set up the recurring invoice.</li>
        <li>Load the client&rsquo;s bank details into Paysoft Flow so the debit order can collect.</li>
      </ol>
      ${ownerDetails(d)}
      ${button(d.proposalUrl, 'View the signed proposal', true)}
      <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">${
        d.pdfUrl
          ? `Signed-proposal PDF archived: <a href="${d.pdfUrl}" style="color:#0f766e;">open in Drive</a>.`
          : 'Signed-proposal PDF: not archived yet (it will be filed once Drive archival is set up).'
      }</p>`);
}

export function renderProvisionFailedOwnerEmail(d) {
  return ownerShell(
    `
      <h1 style="margin:0 0 8px;font-size:18px;color:#b02a37;">Proposal signed, but provisioning failed</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">${escapeHtml(d.businessName)} signed, and the signature is recorded, but the portal records were not created automatically. The proposal is left as signed (not active). Please set the client up by hand: create the org, membership and subscription, then the Xero contact and Paysoft Flow mandate.</p>
      <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#6b7280;">The automated setup did not complete. Check the application logs for the diagnostic details and complete the setup manually.</p>
      ${ownerDetails(d)}
      ${button(d.proposalUrl, 'View the signed proposal', true)}`,
    true,
  );
}

function renderStaffProposalEmail(d, amended) {
  return clientShell(`${brand()}
      ${reference(d.refNumber)}
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#111827;">Hi ${escapeHtml(d.firstName)}, ${amended ? 'we&rsquo;ve updated your proposal' : 'here&rsquo;s your proposal again'}</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4b5563;">${
        amended
          ? `We&rsquo;ve revised the Capucor proposal for <strong>${escapeHtml(d.businessName)}</strong>. The updated plan comes to <strong>${formatZAR(d.monthlyZAR)}</strong> per month. Open it to review the changes and sign. This replaces any earlier version.`
          : `Here&rsquo;s a fresh link to the Capucor proposal for <strong>${escapeHtml(d.businessName)}</strong> at <strong>${formatZAR(d.monthlyZAR)}</strong> per month. Open it to review the full details and sign.`
      }</p>
      ${button(d.proposalUrl, amended ? 'View &amp; sign the updated proposal' : 'View &amp; sign your proposal')}
      <p style="margin:0;font-size:12px;color:#6b7280;text-align:center;">Billed monthly in advance · cancel any time with 30 days&rsquo; notice</p>`);
}

export function renderAmendEmail(d) {
  return renderStaffProposalEmail(d, true);
}

export function renderResendEmail(d) {
  return renderStaffProposalEmail(d, false);
}
