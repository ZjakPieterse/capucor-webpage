// Email bodies for the two-step, email-bound proposal signing flow (PR7+).
//
// Hand-rolled, inline-styled HTML so each renders in any email client without a
// build step. Shared by:
//   * /api/proposals/sign         — the "Confirm & sign" request email
//   * /lib/portal/finalizeSign.ts — the post-confirmation client + owner emails
//
// The client confirmation emails carry an explicit "signed on <when>; if this
// wasn't you, reply" line: because the proposal link can be forwarded, that line
// is the genuine recipient's cue that someone attempted a signature on their
// behalf.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Human-readable South African timestamp for the signed-on / fraud-alert line.
function formatSast(iso: string): string {
  return new Date(iso).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' });
}

// ── Step A: confirm-and-sign request ─────────────────────────────────────────
// Sent to the proposal's own address when someone submits a signature at
// /proposal/<token>. Clicking the link (only possible from this inbox) is what
// actually commits the signature — it binds signing to the real recipient.
export function renderSignConfirmEmail(d: {
  firstName: string;
  businessName: string;
  refNumber: string | null;
  confirmUrl: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:32px;">
      <p style="margin:0 0 24px;font-weight:700;font-size:18px;letter-spacing:-0.01em;color:#0f766e;">Capucor</p>
      ${
        d.refNumber
          ? `<p style="margin:0 0 8px;font-size:12px;color:#6b7280;">Reference ${escapeHtml(d.refNumber)}</p>`
          : ''
      }
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#111827;">One more step to sign, ${escapeHtml(d.firstName)}</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">
        We received a signature for the Capucor proposal for <strong>${escapeHtml(d.businessName)}</strong>.
        To finalise it, confirm from this email — this is how we check the signature came from you.
      </p>
      <a href="${d.confirmUrl}" style="display:block;margin:24px 0 8px;background:#0f766e;color:#ffffff;text-decoration:none;text-align:center;font-weight:600;font-size:15px;padding:14px 20px;border-radius:10px;">
        Confirm &amp; sign
      </a>
      <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#6b7280;text-align:center;">
        This link works once and expires in 30 minutes.
      </p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">
        If you didn&rsquo;t request this, ignore this email — nothing is signed until you confirm.
      </p>
    </div>
    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
      Capucor Business Solutions · Outsourced finance for growing SMEs
    </p>
  </div>
</body>
</html>`;
}

// The signed-on / fraud-alert block reused by both client confirmation emails.
function signedAlertBlock(businessName: string, signedAt: string): string {
  return `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:16px;">
        This proposal for <strong>${escapeHtml(businessName)}</strong> was signed on
        ${escapeHtml(formatSast(signedAt))} (SAST). If this wasn&rsquo;t you, reply to this email right away.
      </p>`;
}

// ── Step B: post-confirmation client email (provisioning succeeded) ──────────
// The portal is live. The link points at the normal /login (their email now
// matches a confirmed user), not a one-click magic link.
export function renderProvisionedClientEmail(d: {
  firstName: string;
  businessName: string;
  loginUrl: string;
  signedAt: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:32px;">
      <p style="margin:0 0 24px;font-weight:700;font-size:18px;letter-spacing:-0.01em;color:#0f766e;">Capucor</p>
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#111827;">Thanks, ${escapeHtml(d.firstName)} — your portal is ready</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">
        We&rsquo;ve recorded your acceptance of the Capucor proposal for
        <strong>${escapeHtml(d.businessName)}</strong> and set up your client portal. You can sign in
        any time to see your plan, key dates and documents.
      </p>
      <a href="${d.loginUrl}" style="display:block;margin:24px 0 8px;background:#0f766e;color:#ffffff;text-decoration:none;text-align:center;font-weight:600;font-size:15px;padding:14px 20px;border-radius:10px;">
        Sign in to your portal
      </a>
      <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#6b7280;text-align:center;">
        Use this email address to sign in — no password needed.
      </p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">
        Someone from our team will be in touch shortly to set up your onboarding and get your first
        month underway. Questions in the meantime? Just reply to this email.
      </p>
      ${signedAlertBlock(d.businessName, d.signedAt)}
    </div>
    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
      Capucor Business Solutions · Outsourced finance for growing SMEs
    </p>
  </div>
</body>
</html>`;
}

// ── Step B: post-confirmation client email (provisioning failed) ─────────────
export function renderSignedClientEmail(d: {
  firstName: string;
  businessName: string;
  signedAt: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:32px;">
      <p style="margin:0 0 24px;font-weight:700;font-size:18px;letter-spacing:-0.01em;color:#0f766e;">Capucor</p>
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#111827;">Thanks, ${escapeHtml(d.firstName)} — that&rsquo;s signed</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">
        We&rsquo;ve recorded your acceptance of the Capucor proposal for
        <strong>${escapeHtml(d.businessName)}</strong>. There&rsquo;s nothing more you need to do right now.
      </p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">
        Someone from our team will be in touch shortly to set up your onboarding and get your first month underway.
      </p>
      ${signedAlertBlock(d.businessName, d.signedAt)}
    </div>
    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
      Capucor Business Solutions · Outsourced finance for growing SMEs
    </p>
  </div>
</body>
</html>`;
}

// ── Step B: owner email (provisioning succeeded) ─────────────────────────────
// The portal records exist; this is the cue to set billing up by hand (Paysoft
// Flow has no API).
export function renderProvisionedOwnerEmail(d: {
  fullName: string;
  businessName: string;
  email: string;
  refNumber: string | null;
  signedAt: string;
  proposalUrl: string;
  pdfUrl: string | null;
}): string {
  const when = formatSast(d.signedAt);
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /></head>
<body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:28px;">
      <h1 style="margin:0 0 8px;font-size:18px;color:#111827;">Proposal signed — portal provisioned</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">
        ${escapeHtml(d.businessName)} has signed. The portal org, membership and subscription are
        set up. To start billing:
      </p>
      <ol style="margin:0 0 20px;padding-left:18px;font-size:14px;line-height:1.7;color:#1f2937;">
        <li>Create the Xero contact for ${escapeHtml(d.businessName)} and set up the recurring invoice.</li>
        <li>Load the client&rsquo;s bank details into Paysoft Flow so the debit order can collect.</li>
      </ol>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#1f2937;">
        ${
          d.refNumber
            ? `<tr><td style="padding:4px 0;color:#6b7280;">Reference</td><td style="padding:4px 0;text-align:right;">${escapeHtml(d.refNumber)}</td></tr>`
            : ''
        }
        <tr><td style="padding:4px 0;color:#6b7280;">Business</td><td style="padding:4px 0;text-align:right;">${escapeHtml(d.businessName)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Signed by</td><td style="padding:4px 0;text-align:right;">${escapeHtml(d.fullName)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Email</td><td style="padding:4px 0;text-align:right;">${escapeHtml(d.email)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">When</td><td style="padding:4px 0;text-align:right;">${escapeHtml(when)}</td></tr>
      </table>
      <a href="${d.proposalUrl}" style="display:inline-block;margin-top:24px;background:#0f766e;color:#ffffff;text-decoration:none;text-align:center;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;">
        View the signed proposal
      </a>
      <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
        ${
          d.pdfUrl
            ? `Signed-proposal PDF archived: <a href="${d.pdfUrl}" style="color:#0f766e;">open in Drive</a>.`
            : 'Signed-proposal PDF: not archived yet (it will be filed once Drive archival is set up).'
        }
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ── Step B: owner email (provisioning failed) ────────────────────────────────
// The signature is saved but the portal records were not created. Provision by
// hand and tell the client.
export function renderProvisionFailedOwnerEmail(d: {
  fullName: string;
  businessName: string;
  email: string;
  refNumber: string | null;
  signedAt: string;
  error: string;
  proposalUrl: string;
}): string {
  const when = formatSast(d.signedAt);
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /></head>
<body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#ffffff;border:1px solid #f5c2c7;border-radius:16px;padding:28px;">
      <h1 style="margin:0 0 8px;font-size:18px;color:#b02a37;">Proposal signed — provisioning failed</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">
        ${escapeHtml(d.businessName)} signed, and the signature is recorded, but the portal records
        were not created automatically. The proposal is left as signed (not active). Please set the
        client up by hand: create the org, membership and subscription, then the Xero contact and
        Paysoft Flow mandate.
      </p>
      <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#6b7280;">
        Error: ${escapeHtml(d.error)}
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#1f2937;">
        ${
          d.refNumber
            ? `<tr><td style="padding:4px 0;color:#6b7280;">Reference</td><td style="padding:4px 0;text-align:right;">${escapeHtml(d.refNumber)}</td></tr>`
            : ''
        }
        <tr><td style="padding:4px 0;color:#6b7280;">Business</td><td style="padding:4px 0;text-align:right;">${escapeHtml(d.businessName)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Signed by</td><td style="padding:4px 0;text-align:right;">${escapeHtml(d.fullName)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Email</td><td style="padding:4px 0;text-align:right;">${escapeHtml(d.email)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">When</td><td style="padding:4px 0;text-align:right;">${escapeHtml(when)}</td></tr>
      </table>
      <a href="${d.proposalUrl}" style="display:inline-block;margin-top:24px;background:#0f766e;color:#ffffff;text-decoration:none;text-align:center;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;">
        View the signed proposal
      </a>
    </div>
  </div>
</body>
</html>`;
}
