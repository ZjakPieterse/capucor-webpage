// Finalise a confirmed proposal signature (Step B of the email-bound flow).
// The commit_proposal_signature RPC atomically commits the legal signature,
// consumes the one-time confirmation token and creates its durable fulfilment
// record. The signed PDF and the two "signed" emails are then attempted
// synchronously and stay resumable by the retry runner
// (scripts/reconcile-deliveries.mjs). Signing stops there: no portal records.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db';
import { processProposalFulfilment } from '@/lib/portal/fulfilment';
import type { DeliveryStatus } from '@/lib/email/sendEmail';

export interface FinalizeSignRow {
  id: string;
  token: string;
  ref_number: string | null;
  first_name: string;
  last_name: string;
  business_name: string;
  email: string;
  status: string;
  pending_signature_name: string | null;
  pending_signature_method: string | null;
  pending_signature_image: string | null;
  pending_signature_ip: string | null;
}

export interface FinalizeResult {
  ok: boolean;
  outcome: 'signed' | 'already' | 'invalid' | 'error';
  deliveryStatus?: DeliveryStatus;
}

export async function finalizeProposalSignature(
  admin: SupabaseClient<Database>,
  row: FinalizeSignRow,
  confirmToken: string,
): Promise<FinalizeResult> {
  if (
    !row.pending_signature_name ||
    !row.pending_signature_method ||
    !row.pending_signature_image
  ) {
    return { ok: false, outcome: 'invalid' };
  }

  const signedAt = new Date().toISOString();
  try {
    const { data, error } = await admin.rpc('commit_proposal_signature', {
      p_proposal_id: row.id,
      p_confirm_token: confirmToken,
      p_signed_at: signedAt,
    });
    if (error) throw error;
    if (!data?.[0]) return { ok: false, outcome: 'already' };
  } catch (error) {
    console.error('[SIGN/CONFIRM] atomic commit error:', error);
    return { ok: false, outcome: 'error' };
  }

  const fulfilment = await processProposalFulfilment(
    admin,
    {
      id: row.id,
      token: row.token,
      ref_number: row.ref_number,
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
      business_name: row.business_name,
    },
    signedAt,
  );

  return {
    ok: true,
    outcome: 'signed',
    deliveryStatus: fulfilment.deliveryStatus,
  };
}
