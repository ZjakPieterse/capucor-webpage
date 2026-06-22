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
  // Compliance master-data, admin-set on the internal client card (migration
  // 015). All null until an admin fills them in.
  address: string | null;
  income_tax_no: string | null;
  vat_no: string | null;
  paye_no: string | null;
  uif_no: string | null;
  coida_no: string | null;
  primary_contact_name: string | null;
  // CRM master-data (migration 016). client_type defaults to 'subscription';
  // notes are internal-only (rendered only in the internal Organisation card,
  // never in the client portal).
  client_type: string;
  notes: string | null;
}

export interface OrgSubscriptionRow {
  id: string;
  status: string;
  tier_slug: string;
  // Free-text label for a manually-recorded/legacy plan (migration 016); null for
  // calculator-driven subs, which derive their name from tier_slug.
  plan_label: string | null;
  services: string[];
  monthly_total_zar: string | number;
  total_charge_zar: string | number;
  current_period_start: string | null;
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
      'id, display_name, legal_name, slug, status, primary_contact_email, business_reg_no, drive_folder_url, xero_connected_at, created_at, address, income_tax_no, vat_no, paye_no, uif_no, coida_no, primary_contact_name, client_type, notes',
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
      'id, status, tier_slug, plan_label, services, monthly_total_zar, total_charge_zar, current_period_start, current_period_end, created_at',
    )
    .eq('client_org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as OrgSubscriptionRow | null) ?? null;
}

// Which subscription charge to surface in the portal header. A brand-new sub's
// first debit is current_period_start (the 1st of next month); once that date
// has passed, the next charge is current_period_end. Kept here (not inline in the
// page) so the "now" read stays out of the component render — see the React
// Compiler purity rule — and so it stays unit-testable.
export function resolveUpcomingPayment(
  sub: Pick<OrgSubscriptionRow, 'current_period_start' | 'current_period_end'>,
  now: Date = new Date(),
): { label: string; date: string | null } {
  const start = sub.current_period_start ? new Date(sub.current_period_start) : null;
  if (start && start.getTime() > now.getTime()) {
    return { label: 'First payment', date: sub.current_period_start };
  }
  return { label: 'Next payment', date: sub.current_period_end };
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
// provisioned (PR9), OR — for proposals predating provisioning that aren't yet
// linked to ANY org (client_org_id IS NULL) — by the org's contact email(s).
// Gating the email fallback on a null FK is load-bearing: without it a proposal
// already linked to a DIFFERENT client that happens to share this org's contact
// email would leak in (the bug that made the "Latest proposal" card show another
// client's proposal). Matching on the FK means a client's proposals show no matter
// which contact signed (one contact can be on several clients). `ilike` with no
// wildcards is a case-insensitive exact match; the orgId is a uuid and emails come
// from our own DB (normalised upstream — commas/parens stripped), so the embedded
// or-filter is safe.
export async function getOrgProposals(
  db: SupabaseClient,
  { orgId, emails }: { orgId: string; emails: string[] },
): Promise<ProposalRow[]> {
  const emailOr = emails.map((e) => `email.ilike.${e}`).join(',');
  const orFilter = emails.length
    ? `client_org_id.eq.${orgId},and(client_org_id.is.null,or(${emailOr}))`
    : `client_org_id.eq.${orgId}`;
  const { data } = await db
    .from('proposals')
    .select(
      'id, token, ref_number, version, supersedes_id, superseded_by_id, business_name, first_name, last_name, email, tier_slug, monthly_total_zar, status, sent_at, signed_at, created_at, proposal_pdf_drive_id',
    )
    .or(orFilter)
    .order('created_at', { ascending: false })
    .limit(100);
  return (data ?? []) as unknown as ProposalRow[];
}

// Resolve client_org_members.user_id → a human label (email, or full_name when
// set) for the internal Access card. Identity lives in auth.users, which only the
// service-role admin client can read — so this MUST be passed the admin client
// (mirrors the auth.admin usage in ./provision.ts). Returns a map; ids that fail
// to resolve are simply absent, so callers fall back to the raw id.
export async function getMemberEmails(
  admin: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  await Promise.all(
    userIds.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      const u = data?.user;
      const label = (u?.user_metadata?.full_name as string | undefined)?.trim() || u?.email;
      if (label) map.set(id, label);
    }),
  );
  return map;
}

// ── Internal clients list ────────────────────────────────────────────────────

export interface ClientOrgListRow {
  id: string;
  display_name: string;
  slug: string;
  status: string;
  client_type: string;
  primary_contact_email: string;
  created_at: string;
}

export async function getAllClientOrgs(db: SupabaseClient): Promise<ClientOrgListRow[]> {
  const { data } = await db
    .from('client_orgs')
    .select('id, display_name, slug, status, client_type, primary_contact_email, created_at')
    .order('display_name', { ascending: true });
  return (data ?? []) as unknown as ClientOrgListRow[];
}

export interface OrgSubscriptionSummary {
  client_org_id: string;
  status: string;
  tier_slug: string;
  plan_label: string | null;
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
    .select('client_org_id, status, tier_slug, plan_label, created_at')
    .in('client_org_id', orgIds)
    .order('created_at', { ascending: false });

  for (const row of (data ?? []) as unknown as OrgSubscriptionSummary[]) {
    if (row.client_org_id && !map.has(row.client_org_id)) map.set(row.client_org_id, row);
  }
  return map;
}
