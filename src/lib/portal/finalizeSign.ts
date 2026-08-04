// Finalise a confirmed proposal signature (Step B of the email-bound flow).
// The OS-owned RPC atomically commits the legal signature, consumes the one-time
// confirmation token and creates its durable fulfilment record. External work
// is then attempted synchronously but remains resumable by the OS Action.

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
  outcome: 'signed' | 'already' | 'invalid' | 'error';
  provisioned?: boolean;
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
      services: row.services,
      brackets: row.brackets,
      tier_slug: row.tier_slug,
      addons: row.addons,
      monthly_total_zar: row.monthly_total_zar,
      vat_zar: row.vat_zar,
      total_charge_zar: row.total_charge_zar,
      status: 'signed',
      client_org_id: row.client_org_id,
    },
    signedAt,
  );

  return {
    ok: true,
    outcome: 'signed',
    provisioned: fulfilment.provisioned,
    deliveryStatus: fulfilment.deliveryStatus,
  };
}
