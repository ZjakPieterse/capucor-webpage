import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db';
import { slugify } from './orgSlug';

/**
 * Portal provisioning still starts on capucor.com, but every database-only
 * invariant now belongs to capucor-os's `provision_from_signed_proposal` RPC.
 * Supabase Auth user creation cannot join that transaction, so it happens first
 * and is deliberately re-entrant; a retry locates the same user and calls the
 * transaction again.
 *
 * Schema ownership warning: the RPC and every migration it depends on live in
 * capucor-os. Keep the generated Database contract in both repositories in sync.
 */

export interface ProposalForProvision {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  business_name: string;
  services: string[];
  brackets: Record<string, number>;
  tier_slug: string;
  addons: string[] | null;
  monthly_total_zar: number | string;
  vat_zar: number | string;
  total_charge_zar: number | string;
  status: string;
  client_org_id: string | null;
}

export interface ProvisionResult {
  ok: boolean;
  orgId?: string;
  userId?: string;
  created?: { org: boolean; membership: boolean; subscription: boolean };
  alreadyProvisioned?: boolean;
  error?: string;
}

async function findOrCreateAuthUser(
  admin: SupabaseClient<Database>,
  email: string,
): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
    });
  if (created?.user?.id) return created.user.id;

  // generateLink does not send a message. For an existing address it returns
  // the same auth user, which makes retries safe after an earlier Auth success.
  const { data: existing, error: locateError } =
    await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
    });
  if (existing?.user?.id) return existing.user.id;

  throw new Error(
    `Could not create or locate the portal auth user: ${
      createError?.message || locateError?.message || 'unknown Auth error'
    }`,
  );
}

export async function provisionFromSignedProposal(
  admin: SupabaseClient<Database>,
  proposal: ProposalForProvision,
): Promise<ProvisionResult> {
  if (!['signed', 'active'].includes(proposal.status)) {
    return {
      ok: false,
      error: `Cannot provision a proposal with status "${proposal.status}".`,
    };
  }

  try {
    const userId = await findOrCreateAuthUser(admin, proposal.email);
    const { data, error } = await admin.rpc('provision_from_signed_proposal', {
      p_proposal_id: proposal.id,
      p_user_id: userId,
      p_org_slug: slugify(proposal.business_name),
    });
    if (error) throw error;

    const result = data?.[0];
    if (!result)
      throw new Error('Provisioning transaction returned no result.');

    return {
      ok: true,
      orgId: result.org_id,
      userId: result.user_id,
      created: {
        org: result.org_created,
        membership: result.membership_created,
        subscription: result.subscription_created,
      },
      alreadyProvisioned: result.already_provisioned,
    };
  } catch (error) {
    console.error('[PROVISION] recoverable stage failed:', error);
    const detail = error as { message?: string } | null;
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : (detail?.message ?? 'Provisioning failed.'),
    };
  }
}
