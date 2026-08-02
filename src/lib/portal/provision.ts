import type { SupabaseClient } from '@supabase/supabase-js';
import { firstOfNextMonth } from '@/lib/utils';
import { findFreeSlug, slugify } from './orgSlug';

/**
 * ⚠️ SCHEMA SEAM — READ BEFORE CHANGING ANY TABLE THIS FILE TOUCHES.
 *
 * ► The schema is owned by the **capucor-os** repo. `supabase/migrations/` lives
 *   there and only there (capucor-web's copy was deleted in Phase 3 of the OS
 *   split). This file is the one place where **capucor.com writes to tables
 *   another repo owns**.
 *
 * ► It runs on capucor.com, at signing — not on capucor.app. Deleting the OS
 *   half of this repo did not move provisioning; a client signs on the marketing
 *   domain, and this is what gives them portal access on capucor.app.
 *
 * ► Tables written here (exact names — `client_org_members`, NOT "memberships"):
 *       client_orgs          insert + select   display_name, slug,
 *                                              primary_contact_email, status
 *       client_org_members   insert + select   client_org_id, user_id, role
 *       subscriptions        insert + update   see upsertSubscription's `plan`
 *                                              + current_period_start/_end
 *       proposals            update            status, client_org_id
 *   plus `auth.users` via admin.auth.admin.createUser / generateLink.
 *
 * ► THE FAILURE MODE THIS COMMENT EXISTS TO PREVENT: rename or drop one of those
 *   columns in a capucor-os migration and NOTHING here breaks at build time —
 *   no compile error, no failing test in either repo. The symptom is a paying
 *   client who signs and never gets portal access, discovered whenever someone
 *   notices. `src/__tests__/portal-provision.test.ts` pins the exact column set
 *   written to each table so that a rename lands as a RED TEST instead. If you
 *   are changing this file's writes, change that test deliberately — do not
 *   "fix" it to match new behaviour without checking the migration it implies.
 *
 * ► When one of those four tables is genuinely reshaped, the right fix is to
 *   move this logic into a Postgres function owned by capucor-os's migrations
 *   (`provision_from_signed_proposal(proposal_id)`) and call it from here via a
 *   single RPC. Do not pre-empt that; it is the right fix at the wrong time
 *   until a reshape actually happens.
 *
 * PR9 — provision-on-sign.
 *
 * When a proposal is signed (= the debit-order mandate is authorised; there is
 * no on-site payment step — collection is done manually via Paysoft Flow off
 * Xero), give the client portal access: create-or-locate their org, membership,
 * and a subscription row, then promote the proposal to `active` and link it back
 * to the org.
 *
 * This module does the DB + auth work ONLY. It never sends email (the sign route
 * owns email, where Resend is already wired) and it never calls any payment or
 * collection API — billing is provisioned manually in Xero/Paysoft Flow, and the
 * owner notification (sent by the route) is Zjak's cue to do that.
 *
 * Everything is idempotent: a re-run reuses the linked org/membership/sub rather
 * than duplicating them, and a proposal already promoted to `active` is a no-op.
 * A failure anywhere leaves the proposal `signed` (never a half-provisioned
 * `active`) — the route alerts the owner so it can be finished by hand.
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
  /** Which records this run created (false = reused an existing one). */
  created?: { org: boolean; membership: boolean; subscription: boolean };
  /** True when the proposal was already provisioned (idempotent no-op). */
  alreadyProvisioned?: boolean;
  error?: string;
}

// ── Auth user ────────────────────────────────────────────────────────────────

// The client almost never has an auth.users row at sign time, but
// client_org_members.user_id FKs to it (004). Mint the user now so membership is
// possible; they sign in later via the normal /login flow (their email already
// matches a confirmed user, so the magic-link/Google sign-in just works).
async function findOrCreateAuthUser(
  admin: SupabaseClient,
  email: string,
): Promise<string> {
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (created?.user?.id) return created.user.id;

  // createUser failed — almost always because the email is already registered.
  // Read the existing user's id by generating (and discarding) a magic link for
  // it; generateLink for an existing address returns the user without sending.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (link?.user?.id) return link.user.id;

  throw new Error(
    `Could not create or locate an auth user for ${email}: ${
      createErr?.message ?? ''
    } ${linkErr?.message ?? ''}`.trim(),
  );
}

// ── Org ──────────────────────────────────────────────────────────────────────
// slugify + findFreeSlug live in ./orgSlug (shared with the admin "Add client"
// create flow) so both paths mint unique slugs identically.

interface OrgResult {
  id: string;
  created: boolean;
}

async function findOrCreateOrg(
  admin: SupabaseClient,
  proposal: ProposalForProvision,
): Promise<OrgResult> {
  // 1. Already linked by a prior provision run.
  if (proposal.client_org_id) {
    const { data } = await admin
      .from('client_orgs')
      .select('id')
      .eq('id', proposal.client_org_id)
      .maybeSingle();
    if (data?.id) return { id: data.id as string, created: false };
  }

  const email = proposal.email.trim();
  // The proposal captures one business name; that becomes the org's DISPLAY NAME
  // (the human name shown in the portal/proposals and — once wired — used to name
  // the org in Karbon/Xero/Google Drive). legal_name is admin-set later and is
  // never touched here. See migration 014.
  const name = proposal.business_name.trim();

  // 2. A client is uniquely the ORGANISATION NAME (one contact can be on several
  //    clients), so dedupe by display_name (case-insensitive) regardless of
  //    contact — never create a second org for a business that already exists. The
  //    JS re-check guards against `ilike` treating any %/_ in a name as a wildcard.
  const { data: existing } = await admin
    .from('client_orgs')
    .select('id, display_name')
    .ilike('display_name', name);
  const match = (existing as { id: string; display_name: string }[] | null ?? []).find(
    (o) => o.display_name.trim().toLowerCase() === name.toLowerCase(),
  );
  if (match?.id) return { id: match.id, created: false };

  // 3. Create a fresh org with a unique slug.
  const slug = await findFreeSlug(admin, slugify(name));
  const { data: inserted, error } = await admin
    .from('client_orgs')
    .insert({
      display_name: name,
      slug,
      primary_contact_email: email,
      status: 'active',
    })
    .select('id')
    .single();
  if (error) throw error;
  return { id: (inserted as { id: string }).id, created: true };
}

// ── Membership ───────────────────────────────────────────────────────────────

async function ensureMembership(
  admin: SupabaseClient,
  orgId: string,
  userId: string,
): Promise<{ created: boolean }> {
  const { data: existing } = await admin
    .from('client_org_members')
    .select('id')
    .eq('client_org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();
  if (existing?.id) return { created: false };

  const { error } = await admin
    .from('client_org_members')
    .insert({ client_org_id: orgId, user_id: userId, role: 'owner' });
  if (error) {
    // A concurrent provision may have inserted the same (org, user) first — the
    // unique constraint (004) makes that a 23505; treat it as already present.
    if ((error as { code?: string }).code === '23505') return { created: false };
    throw error;
  }
  return { created: true };
}

// ── Subscription ─────────────────────────────────────────────────────────────

// A portal org needs a subscriptions row too, or /portal shows the "subscription
// not ready" empty state (portal/page.tsx). The most recent signed proposal is
// the source of truth, so UPDATE the org's existing subscription in place to the
// new plan (one current sub per org, no duplicate); insert one if none exists.
// Totals come from the proposal's already anti-tampered figures. No payment
// fields — collection is manual via Paysoft Flow.
async function upsertSubscription(
  admin: SupabaseClient,
  orgId: string,
  proposal: ProposalForProvision,
): Promise<{ created: boolean }> {
  const plan = {
    email: proposal.email,
    full_name: `${proposal.first_name} ${proposal.last_name}`.trim(),
    business: proposal.business_name,
    services: proposal.services,
    brackets: proposal.brackets,
    tier_slug: proposal.tier_slug,
    monthly_total_zar: proposal.monthly_total_zar,
    vat_zar: proposal.vat_zar,
    total_charge_zar: proposal.total_charge_zar,
    status: 'active',
  };

  const { data: existing } = await admin
    .from('subscriptions')
    .select('id')
    .eq('client_org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    // Most recent signed proposal overrides the existing plan.
    const { error } = await admin
      .from('subscriptions')
      .update(plan)
      .eq('id', (existing as { id: string }).id);
    if (error) throw error;
    return { created: false };
  }

  // Subscriptions always start on the 1st of the next calendar month (aligned to
  // the billing cycle), not the signing date. The proposal/PDF/email show this
  // same first-debit date, computed the same way.
  const periodStart = firstOfNextMonth();
  const { error } = await admin.from('subscriptions').insert({
    client_org_id: orgId,
    ...plan,
    current_period_start: periodStart.toISOString(),
    current_period_end: firstOfNextMonth(periodStart).toISOString(),
  });
  if (error) throw error;
  return { created: true };
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

export async function provisionFromSignedProposal(
  admin: SupabaseClient,
  proposal: ProposalForProvision,
): Promise<ProvisionResult> {
  // Already promoted + linked → nothing to do.
  if (proposal.status === 'active' && proposal.client_org_id) {
    return { ok: true, orgId: proposal.client_org_id, alreadyProvisioned: true };
  }
  // Only a signed proposal should provision. (An `active` row without a link
  // falls through and re-provisions, which find-or-create makes safe.)
  if (proposal.status !== 'signed' && proposal.status !== 'active') {
    return {
      ok: false,
      error: `Cannot provision a proposal with status "${proposal.status}".`,
    };
  }

  try {
    const userId = await findOrCreateAuthUser(admin, proposal.email);
    const org = await findOrCreateOrg(admin, proposal);
    const membership = await ensureMembership(admin, org.id, userId);
    const subscription = await upsertSubscription(admin, org.id, proposal);

    // Promote the proposal to active + link the org, guarded so we only ever flip
    // a signed/active row. Zero rows (a concurrent flip) is still success.
    const { error: promoteErr } = await admin
      .from('proposals')
      .update({ status: 'active', client_org_id: org.id })
      .eq('id', proposal.id)
      .in('status', ['signed', 'active']);
    if (promoteErr) throw promoteErr;

    return {
      ok: true,
      orgId: org.id,
      userId,
      created: {
        org: org.created,
        membership: membership.created,
        subscription: subscription.created,
      },
    };
  } catch (err) {
    console.error('[PROVISION] error:', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Provisioning failed.',
    };
  }
}
