// Pure helpers for linking proposals to a client org by contact email. proposals
// has no client_org_id FK (that link arrives with PR9 provisioning), so the
// internal client view matches on the org's contact email(s). Kept dependency-free
// so it is unit-testable and reusable.

// Lowercase, trim, drop blanks/malformed, and de-dupe. PostgREST or-filters are
// comma/paren delimited, so anything carrying those (never a real email) is
// dropped to keep the generated filter safe.
export function normaliseOrgEmails(
  emails: (string | null | undefined)[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of emails) {
    if (!raw) continue;
    const e = raw.trim().toLowerCase();
    if (!e.includes('@')) continue;
    if (/[,()]/.test(e)) continue;
    if (seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

// Case-insensitive membership of a proposal's email in the candidate set. The DB
// query already filters; this mirrors the rule for tests and as a defensive guard.
export function filterProposalsByEmail<T extends { email: string }>(
  rows: T[],
  emails: string[],
): T[] {
  const set = new Set(emails.map((e) => e.toLowerCase()));
  if (set.size === 0) return [];
  return rows.filter((r) => set.has(r.email.trim().toLowerCase()));
}
