// Finalise a confirmed proposal signature (Step B of the email-bound sign flow).
//
// Called from POST /api/proposals/sign/confirm once the recipient has clicked
// the one-time confirm link from their own inbox. It promotes the pending
// signature into the real signature columns, flips status to `signed`,
// provisions portal access, archives the signed PDF, and sends the client +
// owner emails — the same commit the one-shot sign route used to do inline.
//
// Splitting it out keeps the confirm route thin and the commit testable, and
// means the email-binding step is the only thing standing between "submitted a
// signature" and "legally signed".

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db';
import { provisionFromSignedProposal } from '@/lib/portal/provision';
import { archiveSignedProposal } from '@/lib/portal/proposalPdf';
import {
  renderProvisionedClientEmail,
  renderSignedClientEmail,
  renderProvisionedOwnerEmail,
  renderProvisionFailedOwnerEmail,
} from '@/lib/portal/signEmails';
import { siteConfig } from '@/config/site';

// The row the confirm route loads by sign_confirm_token, including the pending
// signature stashed at Step A.
export interface FinalizeSignRow {
  id: string;
  token: string;
  ref_number: string | null;
  first_name: string;
  last_name: string;
  business_name: string;
  email: string;
  status: string;
  services: string[];
  brackets: Record<string, number>;
  tier_slug: string;
  addons: string[] | null;
  monthly_total_zar: number | string;
  vat_zar: number | string;
  total_charge_zar: number | string;
  client_org_id: string | null;
  pending_signature_name: string | null;
  pending_signature_method: string | null;
  pending_signature_image: string | null;
  pending_signature_ip: string | null;
}

export interface FinalizeResult {
  ok: boolean;
  // 'signed'  — committed (provisioning may still have failed; see `provisioned`)
  // 'already' — lost the race / already signed (idempotent no-op)
  // 'invalid' — no pending signature to commit
  // 'error'   — DB write failed
  outcome: 'signed' | 'already' | 'invalid' | 'error';
  provisioned?: boolean;
}

export async function finalizeProposalSignature(
  admin: SupabaseClient<Database>,
  row: FinalizeSignRow,
): Promise<FinalizeResult> {
  if (
    !row.pending_signature_name ||
    !row.pending_signature_method ||
    !row.pending_signature_image
  ) {
    return { ok: false, outcome: 'invalid' };
  }

  const nowIso = new Date().toISOString();

  // 1. Promote the pending signature into the real columns and flip to `signed`.
  //    The status filter repeats the guard so a concurrent confirm (or the
  //    expiry cron) can't double-sign; zero rows means we lost that race. The
  //    same write clears the pending + confirm columns, making the link single-use.
  try {
    const { data: updated, error } = await admin
      .from('proposals')
      .update({
        status: 'signed',
        signed_at: nowIso,
        signature_name: row.pending_signature_name,
        signature_method: row.pending_signature_method,
        signature_image: row.pending_signature_image,
        signature_ip: row.pending_signature_ip,
        pending_signature_name: null,
        pending_signature_method: null,
        pending_signature_image: null,
        pending_signature_ip: null,
        sign_confirm_token: null,
        sign_confirm_expires_at: null,
      })
      .eq('id', row.id)
      .in('status', ['sent', 'viewed'])
      .select('id');

    if (error) throw error;
    if (!updated || updated.length === 0) {
      return { ok: false, outcome: 'already' };
    }
  } catch (err) {
    console.error('[SIGN/CONFIRM] commit error:', err);
    return { ok: false, outcome: 'error' };
  }

  // 2. Provision portal access (PR9). Non-fatal: a failure leaves the proposal
  //    `signed` (not a half-provisioned `active`); the owner gets an alert below.
  const provision = await provisionFromSignedProposal(admin, {
    id: row.id,
    email: row.email,
    first_name: row.first_name,
    last_name: row.last_name,
    business_name: row.business_name,
    services: row.services,
    brackets: row.brackets,
    tier_slug: row.tier_slug,
    addons: row.addons,
    monthly_total_zar: row.monthly_total_zar,
    vat_zar: row.vat_zar,
    total_charge_zar: row.total_charge_zar,
    status: 'signed',
    client_org_id: row.client_org_id,
  });
  const provisioned = provision.ok;

  // 3. Archive the signed proposal as a PDF (PR10). Non-fatal, no-ops until wired.
  const archive = await archiveSignedProposal(admin, row.id);
  const pdfUrl = archive.ok ? (archive.fileUrl ?? null) : null;

  // 4. Emails — non-fatal. The signature is already saved.
  const fullName = `${row.first_name} ${row.last_name}`.trim();
  const proposalUrl = `${siteConfig.marketingUrl}/proposal/${row.token}`;
  // The portal invite is the one link that crosses to Capucor OS — auth lives
  // on capucor.app, so this must NOT use marketingUrl (capucor.com/login 301s
  // here anyway, but sending clients through a redirect is needless).
  const loginUrl = `${siteConfig.appUrl}/login?next=/portal`;
  const resendKey = process.env.RESEND_API_KEY;
  const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;

  if (resendKey) {
    let emailsSent = false;
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(resendKey);

      await resend.emails.send({
        from: siteConfig.email.sender,
        replyTo: siteConfig.email.replyTo,
        to: row.email,
        subject: provisioned
          ? 'Your Capucor portal is ready'
          : 'We’ve received your signed proposal',
        html: provisioned
          ? renderProvisionedClientEmail({
              firstName: row.first_name,
              businessName: row.business_name,
              loginUrl,
              signedAt: nowIso,
            })
          : renderSignedClientEmail({
              firstName: row.first_name,
              businessName: row.business_name,
              signedAt: nowIso,
            }),
      });

      if (ownerEmail) {
        await resend.emails.send({
          from: siteConfig.email.senderWebsite,
          to: ownerEmail,
          subject: provisioned
            ? `Provisioned: ${row.business_name}${row.ref_number ? ` (${row.ref_number})` : ''}, set up billing`
            : `Provisioning FAILED: ${row.business_name}${row.ref_number ? ` (${row.ref_number})` : ''}`,
          html: provisioned
            ? renderProvisionedOwnerEmail({
                fullName,
                businessName: row.business_name,
                email: row.email,
                refNumber: row.ref_number,
                signedAt: nowIso,
                proposalUrl,
                pdfUrl,
              })
            : renderProvisionFailedOwnerEmail({
                fullName,
                businessName: row.business_name,
                email: row.email,
                refNumber: row.ref_number,
                signedAt: nowIso,
                error: provision.error ?? 'unknown error',
                proposalUrl,
              }),
        });
      }

      emailsSent = true;
    } catch (err) {
      console.error('[SIGN/CONFIRM] Resend send error:', err);
    }

    if (emailsSent) {
      const { error: sentAtErr } = await admin
        .from('proposals')
        .update({ signed_email_sent_at: new Date().toISOString() })
        .eq('id', row.id);
      if (sentAtErr) {
        console.error('[SIGN/CONFIRM] signed_email_sent_at update error:', sentAtErr);
      }
    }
  } else {
    console.log(
      `[PROPOSAL SIGNED] business=${row.business_name} email=${row.email} method=${row.pending_signature_method} provisioned=${provisioned}`,
    );
  }

  return { ok: true, outcome: 'signed', provisioned };
}
