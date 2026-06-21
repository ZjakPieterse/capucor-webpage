import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProposalRow } from '@/components/internal/ProposalsTable';

// Org-scoped read helpers shared by the client portal (passed the admin client —
// unchanged behaviour) and the internal view-only mirror (passed the session
// client, so RLS `is_internal` authorises the read — migration 011). Keeping the
// SELECTs here means both audiences read the same columns.

export interface OrgRecord {
  id: string;
  // Human name (portal/proposals + future Karbon/Xero/Drive naming). legal_name
  // is the registered name, admin-set, null until filled in. See migration 014.
  display_name: string;
  legal_name: string | null;
  slug: string;
  status: string;
  primary_contact_email: string;
  business_reg_no: string | null;
  drive_folder_url: string | null;
  xero_connected_at: string | null;
  created_at: string;
}

export interface OrgSubscriptionRow {
  id: string;
  status: string;
  tier_slug: string;
  services: string[];
  monthly_total_zar: string | number;
  total_charge_zar: string | number;
  current_period_end: string | null;
  created_at: string;
}

export interface OrgInvoiceRow {
  id: string;
  amount_zar: string | number;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
  created_at: string;
  paystack_reference: string | null;
}

export interface OrgMemberRow {
  user_id: string;
  role: string;
  created_at: string;
}

// Daily Xero snapshot shape (X4 cron will upsert this into xero_snapshot_cache).
// Every field is optional so a partial snapshot still renders gracefully.
export interface XeroSnapshot {
  cash?: number;
  mtd_revenue?: number;
  mtd_expenses?: number;
  debtors?: number;
  creditors?: number;
  runway_months?: number;
}

export interface OrgFinance {
  xeroConnected: boolean;
  snapshot: XeroSnapshot | null;
  asOf: string | null;
}

export async function getOrgRecord(
  db: SupabaseClient,
  orgId: string,
): Promise<OrgRecord | null> {
  const { data } = await db
    .from('client_orgs')
    .select(
      'id, display_name, legal_name, slug, status, primary_contact_email, business_reg_no, drive_folder_url, xero_connected_at, created_at',
    )
    .eq('id', orgId)
    .maybeSingle();
  return (data as unknown as OrgRecord | null) ?? null;
}

export async function getOrgSubscription(
  db: SupabaseClient,
  orgId: string,
): Promise<OrgSubscriptionRow | null> {
  const { data } = await db
    .from('subscriptions')
    .select(
      'id, status, tier_slug, services, monthly_total_zar, total_charge_zar, current_period_end, created_at',
    )
    .eq('client_org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as OrgSubscriptionRow | null) ?? null;
}

export async function getOrgInvoices(
  db: SupabaseClient,
  orgId: string,
): Promise<OrgInvoiceRow[]> {
  const { data } = await db
    .from('invoices')
    .select(
      'id, amount_zar, status, period_start, period_end, paid_at, created_at, paystack_reference',
    )
    .eq('client_org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(24);
  return (data ?? []) as unknown as OrgInvoiceRow[];
}

export async function getOrgFinance(
  db: SupabaseClient,
  orgId: string,
): Promise<OrgFinance> {
  const [{ data: org }, { data: snap }] = await Promise.all([
    db.from('client_orgs').select('xero_connected_at').eq('id', orgId).maybeSingle(),
    db
      .from('xero_snapshot_cache')
      .select('snapshot, as_of_date')
      .eq('client_org_id', orgId)
      .maybeSingle(),
  ]);

  return {
    xeroConnected: Boolean((org as { xero_connected_at?: string | null } | null)?.xero_connected_at),
    snapshot: (snap?.snapshot as XeroSnapshot | undefined) ?? null,
    asOf: ((snap?.as_of_date as string | null | undefined) ?? null) as string | null,
  };
}

export async function getOrgMembers(
  db: SupabaseClient,
  orgId: string,
): Promise<OrgMemberRow[]> {
  const { data } = await db
    .from('client_org_members')
    .select('user_id, role, created_at')
    .eq('client_org_id', orgId)
    .order('created_at', { ascending: true });
  return (data ?? []) as unknown as OrgMemberRow[];
}

// Proposals for an org: matched by the client_org_id FK once a proposal has been
// provisioned (PR9), OR — for proposals predating provisioning — by the org's
// contact email(s). Matching on the FK means a client's proposals show no matter
// which contact signed (one contact can be on several clients). `ilike` with no
// wildcards is a case-insensitive exact match; the orgId is a uuid and emails
// come from our own DB (normalised upstream), so the or-filter is safe.
export async function getOrgProposals(
  db: SupabaseClient,
  { orgId, emails }: { orgId: string; emails: string[] },
): Promise<ProposalRow[]> {
  const filters = [`client_org_id.eq.${orgId}`, ...emails.map((e) => `email.ilike.${e}`)];
  const { data } = await db
    .from('proposals')
    .select(
      'id, token, ref_number, version, supersedes_id, superseded_by_id, business_name, first_name, last_name, email, tier_slug, monthly_total_zar, status, sent_at, signed_at, created_at, proposal_pdf_drive_id',
    )
    .or(filters.join(','))
    .order('created_at', { ascending: false })
    .limit(100);
  return (data ?? []) as unknown as ProposalRow[];
}

// ── Internal clients list ────────────────────────────────────────────────────

export interface ClientOrgListRow {
  id: string;
  display_name: string;
  slug: string;
  status: string;
  primary_contact_email: string;
  created_at: string;
}

export async function getAllClientOrgs(db: SupabaseClient): Promise<ClientOrgListRow[]> {
  const { data } = await db
    .from('client_orgs')
    .select('id, display_name, slug, status, primary_contact_email, created_at')
    .order('display_name', { ascending: true });
  return (data ?? []) as unknown as ClientOrgListRow[];
}

export interface OrgSubscriptionSummary {
  client_org_id: string;
  status: string;
  tier_slug: string;
  created_at: string;
}

// Latest subscription per org, for the clients-list status/tier columns. Keyed
// newest-first so the first row seen per org wins.
export async function getSubscriptionsByOrg(
  db: SupabaseClient,
  orgIds: string[],
): Promise<Map<string, OrgSubscriptionSummary>> {
  const map = new Map<string, OrgSubscriptionSummary>();
  if (orgIds.length === 0) return map;

  const { data } = await db
    .from('subscriptions')
    .select('client_org_id, status, tier_slug, created_at')
    .in('client_org_id', orgIds)
    .order('created_at', { ascending: false });

  for (const row of (data ?? []) as unknown as OrgSubscriptionSummary[]) {
    if (row.client_org_id && !map.has(row.client_org_id)) map.set(row.client_org_id, row);
  }
  return map;
}
