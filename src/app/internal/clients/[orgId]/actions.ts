'use server';

import { revalidatePath } from 'next/cache';
import { requireInternal } from '@/lib/auth/requireInternal';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type UpdateOrgNamesResult = { ok: true } | { ok: false; error: string };

// Admin-only edit of a client org's Display name + Legal name. A Server Action is
// reachable by direct POST, so the admin check is enforced HERE (not just hidden
// in the UI): requireInternal returns null for a signed-in non-internal user and
// the role gate refuses anyone who is not an admin. The write goes through the
// service-role admin client (client_orgs has no write RLS policy by design —
// migration 004/011), mirroring every other internal mutation.
export async function updateOrgNamesAction(
  orgId: string,
  displayName: string,
  legalName: string,
): Promise<UpdateOrgNamesResult> {
  const internal = await requireInternal(`/internal/clients/${orgId}`);
  if (!internal || internal.role !== 'admin') {
    return { ok: false, error: 'Admin access required.' };
  }

  const display = displayName.trim();
  if (!display) {
    return { ok: false, error: 'Display name is required.' };
  }
  // Legal name is optional — store null when blank (rendered as a dash).
  const legal = legalName.trim() || null;

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('client_orgs')
    .update({ display_name: display, legal_name: legal })
    .eq('id', orgId);

  if (error) {
    return { ok: false, error: 'Could not save the changes. Try again.' };
  }

  // force-dynamic pages re-render on router.refresh(); revalidate the list too so
  // the renamed org shows immediately there as well.
  revalidatePath(`/internal/clients/${orgId}`);
  revalidatePath('/internal/clients');
  return { ok: true };
}
