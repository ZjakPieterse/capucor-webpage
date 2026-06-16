'use server';

import { cookies } from 'next/headers';
import { requireSession } from '@/lib/auth/requireSession';
import { getUserOrgs } from '@/lib/portal/portalContext';
import { ACTIVE_ORG_COOKIE, isOrgMember } from '@/lib/portal/activeOrg';

// Sets the active client_org for a multi-business portal user. A Server Action is
// reachable by direct POST, so re-resolve the session and re-verify membership
// before writing — never trust the submitted id. Setting the cookie re-renders
// the current tree; the switcher also calls router.refresh() so every portal
// page's RSC data re-reads against the new active org.
export async function setActiveOrgAction(orgId: string): Promise<void> {
  const user = await requireSession();
  const orgs = await getUserOrgs(user.id);
  if (!isOrgMember(orgs, orgId)) return;

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}
