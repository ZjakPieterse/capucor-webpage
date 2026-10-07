import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db';
import { sendEmail, type DeliveryStatus } from '@/lib/email/sendEmail';
import {
  SIGNED_CLIENT_EVENT,
  SIGNED_OWNER_EVENT,
  buildSignedClientMessage,
  buildSignedOwnerMessage,
  signedClientIdempotencyKey,
  signedOwnerIdempotencyKey,
} from '@/lib/email/messages.mjs';
import { archiveSignedProposal } from '@/lib/portal/proposalPdf';

const LEASE_MS = 60_000;
const FIRST_RETRY_MS = 10 * 60_000;
const MAX_RETRY_MS = 6 * 60 * 60_000;
const MAX_STAGE_ATTEMPTS = 6;
const MAX_ERROR_LENGTH = 2_000;

// Since web-standalone phase 3 (migration 001) signing stops at `signed` + the
// signed PDF in Drive: pdf → client_email → owner_email. No portal stage.
type Stage = 'pdf' | 'client_email' | 'owner_email';
type FulfilmentRow = Database['public']['Tables']['proposal_fulfilment']['Row'];

export interface ProposalForFulfilment {
  id: string;
  token: string;
  ref_number: string | null;
  email: string;
  first_name: string;
  last_name: string;
  business_name: string;
}

export interface FulfilmentResult {
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
  // A stage this code does not know (the pre-001 `portal` stage, say) is left
  // to its lease expiry rather than guessed at.
  if (!['pdf', 'client_email', 'owner_email'].includes(claimed.stage)) {
    throw new Error(`Unknown fulfilment stage "${claimed.stage}".`);
  }
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

// The owner email links the Drive file, which an earlier attempt (or the retry
// runner) may have archived; read it from the row rather than trusting only
// this request's PDF stage.
async function loadPdfDriveId(
  admin: SupabaseClient<Database>,
  proposalId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('proposals')
    .select('proposal_pdf_drive_id')
    .eq('id', proposalId)
    .maybeSingle();
  if (error) throw error;
  return data?.proposal_pdf_drive_id ?? null;
}

/**
 * Attempt all dependency-ordered stages synchronously for the client experience.
 * Any failed stage is released with durable backoff; the retry runner
 * (scripts/reconcile-deliveries.mjs) later claims exactly the same work. A lease
 * loss is treated as pending, never as failure.
 */
export async function processProposalFulfilment(
  admin: SupabaseClient<Database>,
  proposal: ProposalForFulfilment,
  signedAt: string,
): Promise<FulfilmentResult> {
  let pdfFileId: string | null = null;

  try {
    for (let step = 0; step < 3; step += 1) {
      const claim = await claimStage(admin, proposal.id);
      if (!claim) break;

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

      const signed = {
        ...proposal,
        signed_at: signedAt,
        proposal_pdf_drive_id: null as string | null,
      };

      if (claim.stage === 'client_email') {
        const clientDelivery = await sendEmail({
          sourceType: 'proposal',
          sourceId: proposal.id,
          eventType: SIGNED_CLIENT_EVENT,
          idempotencyKey: signedClientIdempotencyKey(proposal.id),
          adminClient: admin,
          message: buildSignedClientMessage(signed),
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
      signed.proposal_pdf_drive_id =
        pdfFileId ?? (await loadPdfDriveId(admin, proposal.id));
      const ownerDelivery = await sendEmail({
        sourceType: 'proposal',
        sourceId: proposal.id,
        eventType: SIGNED_OWNER_EVENT,
        idempotencyKey: signedOwnerIdempotencyKey(proposal.id),
        adminClient: admin,
        message: buildSignedOwnerMessage(signed, ownerEmail),
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
      deliveryStatus:
        state?.client_email_status === 'accepted' ? 'accepted' : 'pending',
      completed: state?.completed_at != null,
    };
  } catch (error) {
    console.error('[FULFILMENT] state lookup failed:', error);
    return { deliveryStatus: 'pending', completed: false };
  }
}
