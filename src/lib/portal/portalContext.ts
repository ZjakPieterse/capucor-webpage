import type { User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { requireSession } from '@/lib/auth/requireSession';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  ACTIVE_ORG_COOKIE,
  resolveActiveOrgId,
  type OrgSummary,
} from '@/lib/portal/activeOrg';

export interface PortalContext {
  user: User;
  orgs: OrgSummary[];
  activeOrg: OrgSummary | null;
}

// Every org a portal user belongs to (alphabetical). Read via the admin client —
// the same choice the portal already made for membership lookups — so it is
// independent of RLS. Two small queries instead of a relationship embed to keep
// the shape unambiguous.
export async function getUserOrgs(userId: string): Promise<OrgSummary[]> {
  const admin = createSupabaseAdminClient();

  const { data: memberships } = await admin
    .from('client_org_members')
    .select('client_org_id')
    .eq('user_id', userId);

  const ids = (memberships ?? []).map((m) => m.client_org_id as string);
  if (ids.length === 0) return [];

  const { data: orgs } = await admin
    .from('client_orgs')
    .select('id, name, slug, status, primary_contact_email')
    .in('id', ids)
    .order('name', { ascending: true });

  return (orgs ?? []) as unknown as OrgSummary[];
}

// Resolves the signed-in portal user, all their orgs, and the active one. The
// single entry point every /portal page uses instead of the old first-membership
// lookup, so the active org is consistent site-wide.
export async function getPortalContext(): Promise<PortalContext> {
  const user = await requireSession();
  const orgs = await getUserOrgs(user.id);

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? null;
  const activeId = resolveActiveOrgId(orgs, cookieValue);
  const activeOrg = orgs.find((o) => o.id === activeId) ?? null;

  return { user, orgs, activeOrg };
}
