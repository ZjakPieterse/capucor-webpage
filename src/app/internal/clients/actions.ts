'use server';

import { revalidatePath } from 'next/cache';
import { requireInternal } from '@/lib/auth/requireInternal';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { findFreeSlug, slugify } from '@/lib/portal/orgSlug';
import { firstOfNextMonth } from '@/lib/utils';
import { CreateClientSchema, type CreateClientInput } from '@/lib/validations';

export type CreateClientResult = { ok: true; orgId: string } | { ok: false; error: string };

// Trim a free-text field; empty becomes null.
function clean(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed || null;
}

// Admin-only manual creation of a client org (the "Add client" flow). The other
// way an org is born is provision-on-sign (PR9); this is for legacy clients on
// older/custom plans and ad-hoc/prospect clients that never signed a proposal.
//
// A Server Action is reachable by direct POST, so the admin check is enforced HERE
// (not just hidden in the UI), and the write goes through the service-role admin
// client (client_orgs has no write RLS policy by design — migration 004/011),
// mirroring updateOrgDetailsAction. No auth user / membership is created — this is
// an internal record only; portal access is added later if a client needs it.
export async function createClientAction(
  fields: CreateClientInput,
): Promise<CreateClientResult> {
  const internal = await requireInternal('/internal/clients');
  if (!internal || internal.role !== 'admin') {
    return { ok: false, error: 'Admin access required.' };
  }

  const parsed = CreateClientSchema.safeParse(fields);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Some details are invalid.' };
  }
  const d = parsed.data;
  const name = d.displayName.trim();
  const email = d.primaryContactEmail.trim();

  const admin = createSupabaseAdminClient();

  // Dedupe by display_name (case-insensitive) — a client IS its organisation name,
  // the same rule provision-on-sign uses. The JS re-check guards against ilike
  // treating any %/_ in the name as a wildcard.
  const { data: existing } = await admin
    .from('client_orgs')
    .select('id, display_name')
    .ilike('display_name', name);
  const dup = ((existing as { id: string; display_name: string }[] | null) ?? []).find(
    (o) => o.display_name.trim().toLowerCase() === name.toLowerCase(),
  );
  if (dup) {
    return { ok: false, error: 'An organisation with this name already exists.' };
  }

  const slug = await findFreeSlug(admin, slugify(name));
  const { data: inserted, error: orgErr } = await admin
    .from('client_orgs')
    .insert({
      display_name: name,
      slug,
      primary_contact_email: email,
      status: 'active',
      client_type: d.clientType,
      notes: clean(d.notes),
      legal_name: clean(d.legalName),
      business_reg_no: clean(d.registrationNo),
      address: clean(d.address),
      income_tax_no: clean(d.incomeTaxNo),
      vat_no: clean(d.vatNo),
      paye_no: clean(d.payeNo),
      uif_no: clean(d.uifNo),
      coida_no: clean(d.coidaNo),
      primary_contact_name: clean(d.primaryContactName),
    })
    .select('id')
    .single();

  if (orgErr || !inserted) {
    return { ok: false, error: 'Could not create the client. Try again.' };
  }
  const orgId = (inserted as { id: string }).id;

  // Optional manual/legacy subscription. The live calculator can't express these
  // older plans, so store a free-text plan_label + monthly figure and leave
  // services/brackets empty with tier_slug 'custom'. vat_zar stays 0 (tax handled
  // in Xero). Best-effort: if it fails the org still exists and the client view
  // shows "No subscription on file yet." so the gap is visible — we don't unwind
  // the org (and risk a confusing duplicate-name error on re-submit).
  if (d.subscription) {
    const s = d.subscription;
    const periodStart = firstOfNextMonth();
    const { error: subErr } = await admin.from('subscriptions').insert({
      client_org_id: orgId,
      email,
      full_name: clean(d.primaryContactName) ?? name,
      business: name,
      services: [],
      brackets: {},
      tier_slug: 'custom',
      plan_label: s.planLabel.trim(),
      monthly_total_zar: s.monthlyZar,
      vat_zar: 0,
      total_charge_zar: s.monthlyZar,
      status: s.status,
      current_period_start: periodStart.toISOString(),
      current_period_end: firstOfNextMonth(periodStart).toISOString(),
    });
    if (subErr) {
      console.error('[CREATE CLIENT] subscription insert failed:', subErr);
    }
  }

  revalidatePath('/internal/clients');
  return { ok: true, orgId };
}
