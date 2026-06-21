// Pure active-org helpers (no next/server imports) so the resolution logic is
// unit-testable in the node test env. The server pieces — reading the cookie,
// the session, and the DB — live in portalContext.ts.

// Cookie holding the active client_org id for a signed-in portal user. httpOnly
// (only the server reads it); a stale/tampered value is ignored by
// resolveActiveOrgId, which only ever returns an org the user actually belongs to.
export const ACTIVE_ORG_COOKIE = 'capucor_active_org';

export interface OrgSummary {
  id: string;
  display_name: string;
  slug: string;
  status: string;
  primary_contact_email: string;
}

// Decide which org is active for a portal user. The cookie wins only when it
// names an org the user is a member of; otherwise we fall back to the first
// (alphabetical) org. Returns null only when the user has no orgs.
export function resolveActiveOrgId(
  orgs: Pick<OrgSummary, 'id'>[],
  cookieValue: string | null | undefined,
): string | null {
  if (cookieValue && orgs.some((o) => o.id === cookieValue)) return cookieValue;
  return orgs[0]?.id ?? null;
}

// Guard used by setActiveOrgAction before writing the cookie — a Server Action
// is reachable by direct POST, so never trust the requested id.
export function isOrgMember(orgs: Pick<OrgSummary, 'id'>[], orgId: string): boolean {
  return orgs.some((o) => o.id === orgId);
}
