'use server';

import { revalidatePath } from 'next/cache';
import { requireInternal } from '@/lib/auth/requireInternal';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { OrgDetailsSchema, type OrgDetailsInput } from '@/lib/validations';

export type UpdateOrgDetailsResult = { ok: true } | { ok: false; error: string };

// Trim a free-text field; empty becomes null (rendered as a dash in the card).
function clean(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed || null;
}

// Admin-only edit of a client org's compliance details (Organisation card on the
// internal client view). A Server Action is reachable by direct POST, so the
// admin check is enforced HERE (not just hidden in the UI): requireInternal
// returns null for a signed-in non-internal user and the role gate refuses anyone
// who is not an admin. The write goes through the service-role admin client
// (client_orgs has no write RLS policy by design — migration 004/011), mirroring
// every other internal mutation.
export async function updateOrgDetailsAction(
  orgId: string,
  fields: OrgDetailsInput,
): Promise<UpdateOrgDetailsResult> {
  const internal = await requireInternal(`/internal/clients/${orgId}`);
  if (!internal || internal.role !== 'admin') {
    return { ok: false, error: 'Admin access required.' };
  }

  const parsed = OrgDetailsSchema.safeParse(fields);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Some details are invalid.' };
  }
  const d = parsed.data;

  // Required columns (NOT NULL) stay non-null; the rest become null when blank.
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('client_orgs')
    .update({
      display_name: d.displayName.trim(),
      legal_name: clean(d.legalName),
      business_reg_no: clean(d.registrationNo),
      address: clean(d.address),
      income_tax_no: clean(d.incomeTaxNo),
      vat_no: clean(d.vatNo),
      paye_no: clean(d.payeNo),
      uif_no: clean(d.uifNo),
      coida_no: clean(d.coidaNo),
      primary_contact_name: clean(d.primaryContactName),
      primary_contact_email: d.primaryContactEmail.trim(),
    })
    .eq('id', orgId);

  if (error) {
    return { ok: false, error: 'Could not save the changes. Try again.' };
  }

  // force-dynamic pages re-render on router.refresh(); revalidate the list too so
  // a renamed org shows immediately there as well.
  revalidatePath(`/internal/clients/${orgId}`);
  revalidatePath('/internal/clients');
  return { ok: true };
}
