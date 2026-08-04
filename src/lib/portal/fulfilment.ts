import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db';
import { siteConfig } from '@/config/site';
import { sendEmail, type DeliveryStatus } from '@/lib/email/sendEmail';
import { archiveSignedProposal } from '@/lib/portal/proposalPdf';
import {
  provisionFromSignedProposal,
  type ProposalForProvision,
} from '@/lib/portal/provision';
import {
  renderProvisionedClientEmail,
  renderProvisionedOwnerEmail,
  renderProvisionFailedOwnerEmail,
} from '@/lib/portal/signEmails';

const LEASE_MS = 60_000;
const FIRST_RETRY_MS = 10 * 60_000;
const MAX_RETRY_MS = 6 * 60 * 60_000;
const MAX_STAGE_ATTEMPTS = 6;
const MAX_ERROR_LENGTH = 2_000;

type Stage = 'portal' | 'pdf' | 'client_email' | 'owner_email';
type FulfilmentRow = Database['public']['Tables']['proposal_fulfilment']['Row'];

export interface ProposalForFulfilment extends ProposalForProvision {
  token: string;
  ref_number: string | null;
}

export interface FulfilmentResult {
  provisioned: boolean;
  deliveryStatus: DeliveryStatus;
  completed: boolean;
}

function retryAt(attempt: number): string {
  const delay = Math.min(
    FIRST_RETRY_MS * 2 ** Math.max(0, attempt - 1),
    MAX_RETRY_MS,
  );
  return new Date(Date.now() + delay).toISOString();
}

function errorDetails(
  error: unknown,
  fallbackCode: string,
): { code: string; message: string } {
  const candidate = error as { code?: string; message?: string } | null;
  return {
    code: String(candidate?.code || fallbackCode).slice(0, MAX_ERROR_LENGTH),
    message: String(candidate?.message || error || fallbackCode).slice(
      0,
      MAX_ERROR_LENGTH,
    ),
  };
}

async function claimStage(
  admin: SupabaseClient<Database>,
  proposalId: string,
): Promise<{ stage: Stage; attempt: number; leaseToken: string } | null> {
  const leaseToken = crypto.randomUUID();
  const { data, error } = await admin.rpc('claim_proposal_fulfilment_stage', {
    p_proposal_id: proposalId,
    p_lease_token: leaseToken,
    p_lease_expires_at: new Date(Date.now() + LEASE_MS).toISOString(),
  });
  if (error) throw error;
  const claimed = data?.[0];
  if (!claimed) return null;
  return {
    stage: claimed.stage as Stage,
    attempt: claimed.attempt_count,
    leaseToken,
  };
}

async function finishStage(
  admin: SupabaseClient<Database>,
  input: {
    proposalId: string;
    leaseToken: string;
    stage: Stage;
    outcome:
      | 'success'
      | 'retry_scheduled'
      | 'permanently_failed'
      | 'not_required';
    nextAttemptAt?: string | null;
    deliveryId?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  },
): Promise<boolean> {
  const args: Database['public']['Functions']['finish_proposal_fulfilment_stage']['Args'] =
    {
      p_proposal_id: input.proposalId,
      p_lease_token: input.leaseToken,
      p_stage: input.stage,
      p_outcome: input.outcome,
      p_finished_at: new Date().toISOString(),
    };
  if (input.nextAttemptAt) args.p_next_attempt_at = input.nextAttemptAt;
  if (input.deliveryId) args.p_delivery_id = input.deliveryId;
  if (input.errorCode) args.p_error_code = input.errorCode;
  if (input.errorMessage) args.p_error_message = input.errorMessage;
  const { data, error } = await admin.rpc(
    'finish_proposal_fulfilment_stage',
    args,
  );
  if (error) throw error;
  return data === true;
}

async function loadState(
  admin: SupabaseClient<Database>,
  proposalId: string,
): Promise<FulfilmentRow | null> {
  const { data, error } = await admin
    .from('proposal_fulfilment')
    .select('*')
    .eq('proposal_id', proposalId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function notifyPortalFailure(
  admin: SupabaseClient<Database>,
  proposal: ProposalForFulfilment,
  signedAt: string,
): Promise<void> {
  const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;
  if (!ownerEmail) return;
  await sendEmail({
    sourceType: 'proposal',
    sourceId: proposal.id,
    eventType: 'proposal.provision_failed_owner',
    idempotencyKey: `capucor_web_proposal_provision_failed_owner_${proposal.id}`,
    adminClient: admin,
    message: {
      from: siteConfig.email.senderWebsite,
      to: ownerEmail,
      subject: `Provisioning FAILED: ${proposal.business_name}${proposal.ref_number ? ` (${proposal.ref_number})` : ''}`,
      html: renderProvisionFailedOwnerEmail({
        fullName: `${proposal.first_name} ${proposal.last_name}`.trim(),
        businessName: proposal.business_name,
        email: proposal.email,
        refNumber: proposal.ref_number,
        signedAt,
        proposalUrl: `${siteConfig.marketingUrl}/proposal/${proposal.token}`,
      }),
    },
  });
}

/**
 * Attempt all dependency-ordered stages synchronously for the client experience.
 * Any failed stage is released with durable backoff; the OS Action later claims
 * exactly the same work. A lease loss is treated as pending, never as failure.
 */
export async function processProposalFulfilment(
  admin: SupabaseClient<Database>,
  proposal: ProposalForFulfilment,
  signedAt: string,
): Promise<FulfilmentResult> {
  let pdfFileId: string | null = null;

  try {
    for (let step = 0; step < 4; step += 1) {
      const claim = await claimStage(admin, proposal.id);
      if (!claim) break;

      if (claim.stage === 'portal') {
        const provision = await provisionFromSignedProposal(admin, {
          ...proposal,
          status: 'signed',
        });
        if (!provision.ok) {
          const detail = errorDetails(
            provision.error,
            'portal_provision_failed',
          );
          const permanent = claim.attempt >= MAX_STAGE_ATTEMPTS;
          await finishStage(admin, {
            proposalId: proposal.id,
            leaseToken: claim.leaseToken,
            stage: claim.stage,
            outcome: permanent ? 'permanently_failed' : 'retry_scheduled',
            nextAttemptAt: permanent ? null : retryAt(claim.attempt),
            errorCode: permanent ? 'max_attempts_exhausted' : detail.code,
            errorMessage: permanent
              ? `Portal provisioning exhausted ${MAX_STAGE_ATTEMPTS} attempts: ${detail.message}`
              : detail.message,
          });
          await notifyPortalFailure(admin, proposal, signedAt);
          break;
        }
        await finishStage(admin, {
          proposalId: proposal.id,
          leaseToken: claim.leaseToken,
          stage: claim.stage,
          outcome: 'success',
        });
        continue;
      }

      if (claim.stage === 'pdf') {
        const archive = await archiveSignedProposal(admin, proposal.id);
        if (!archive.ok) {
          const detail = errorDetails(
            archive.error ??
              (archive.skipped ? 'PDF archival is not configured.' : undefined),
            archive.skipped ? 'pdf_not_configured' : 'pdf_archive_failed',
          );
          const permanent = claim.attempt >= MAX_STAGE_ATTEMPTS;
          await finishStage(admin, {
            proposalId: proposal.id,
            leaseToken: claim.leaseToken,
            stage: claim.stage,
            outcome: permanent ? 'permanently_failed' : 'retry_scheduled',
            nextAttemptAt: permanent ? null : retryAt(claim.attempt),
            errorCode: permanent ? 'max_attempts_exhausted' : detail.code,
            errorMessage: permanent
              ? `PDF archival exhausted ${MAX_STAGE_ATTEMPTS} attempts: ${detail.message}`
              : detail.message,
          });
          break;
        }
        pdfFileId = archive.fileId ?? null;
        await finishStage(admin, {
          proposalId: proposal.id,
          leaseToken: claim.leaseToken,
          stage: claim.stage,
          outcome: 'success',
        });
        continue;
      }

      if (claim.stage === 'client_email') {
        const clientDelivery = await sendEmail({
          sourceType: 'proposal',
          sourceId: proposal.id,
          eventType: 'proposal.portal_ready_client',
          idempotencyKey: `capucor_web_proposal_portal_ready_client_${proposal.id}`,
          adminClient: admin,
          message: {
            from: siteConfig.email.sender,
            replyTo: siteConfig.email.replyTo,
            to: proposal.email,
            subject: 'Your Capucor portal is ready',
            html: renderProvisionedClientEmail({
              firstName: proposal.first_name,
              businessName: proposal.business_name,
              loginUrl: `${siteConfig.appUrl}/login?next=/portal`,
              signedAt,
            }),
          },
        });
        await finishStage(admin, {
          proposalId: proposal.id,
          leaseToken: claim.leaseToken,
          stage: claim.stage,
          outcome:
            clientDelivery.deliveryStatus === 'accepted'
              ? 'success'
              : 'retry_scheduled',
          nextAttemptAt:
            clientDelivery.deliveryStatus === 'accepted'
              ? null
              : retryAt(claim.attempt),
          deliveryId: clientDelivery.deliveryId,
          errorCode: clientDelivery.errorCode,
          errorMessage: clientDelivery.errorMessage,
        });
        if (clientDelivery.deliveryStatus !== 'accepted') break;

        const { error: sentAtError } = await admin
          .from('proposals')
          .update({ signed_email_sent_at: new Date().toISOString() })
          .eq('id', proposal.id)
          .is('signed_email_sent_at', null);
        if (sentAtError) {
          console.error(
            '[FULFILMENT] signed email timestamp update failed:',
            sentAtError,
          );
        }
        continue;
      }

      const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;
      if (!ownerEmail) {
        await finishStage(admin, {
          proposalId: proposal.id,
          leaseToken: claim.leaseToken,
          stage: claim.stage,
          outcome: 'not_required',
        });
        continue;
      }
      const ownerDelivery = await sendEmail({
        sourceType: 'proposal',
        sourceId: proposal.id,
        eventType: 'proposal.provisioned_owner',
        idempotencyKey: `capucor_web_proposal_provisioned_owner_${proposal.id}`,
        adminClient: admin,
        message: {
          from: siteConfig.email.senderWebsite,
          to: ownerEmail,
          subject: `Provisioned: ${proposal.business_name}${proposal.ref_number ? ` (${proposal.ref_number})` : ''}, set up billing`,
          html: renderProvisionedOwnerEmail({
            fullName: `${proposal.first_name} ${proposal.last_name}`.trim(),
            businessName: proposal.business_name,
            email: proposal.email,
            refNumber: proposal.ref_number,
            signedAt,
            proposalUrl: `${siteConfig.marketingUrl}/proposal/${proposal.token}`,
            pdfUrl: pdfFileId
              ? `https://drive.google.com/file/d/${pdfFileId}/view`
              : null,
          }),
        },
      });
      await finishStage(admin, {
        proposalId: proposal.id,
        leaseToken: claim.leaseToken,
        stage: claim.stage,
        outcome:
          ownerDelivery.deliveryStatus === 'accepted'
            ? 'success'
            : 'retry_scheduled',
        nextAttemptAt:
          ownerDelivery.deliveryStatus === 'accepted'
            ? null
            : retryAt(claim.attempt),
        deliveryId: ownerDelivery.deliveryId,
        errorCode: ownerDelivery.errorCode,
        errorMessage: ownerDelivery.errorMessage,
      });
      if (ownerDelivery.deliveryStatus !== 'accepted') break;
    }
  } catch (error) {
    // The signature is already committed with a durable row. A request-level
    // orchestration error is therefore pending work, not a failed signature.
    console.error('[FULFILMENT] synchronous attempt failed:', error);
  }

  try {
    const state = await loadState(admin, proposal.id);
    return {
      provisioned: state?.portal_status === 'complete',
      deliveryStatus:
        state?.client_email_status === 'accepted' ? 'accepted' : 'pending',
      completed: state?.completed_at != null,
    };
  } catch (error) {
    console.error('[FULFILMENT] state lookup failed:', error);
    return { provisioned: false, deliveryStatus: 'pending', completed: false };
  }
}
