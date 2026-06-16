import { describe, it, expect } from 'vitest';
import { resolveActiveOrgId, isOrgMember } from '@/lib/portal/activeOrg';

const ORGS = [{ id: 'org-a' }, { id: 'org-b' }, { id: 'org-c' }];

describe('resolveActiveOrgId', () => {
  it('returns the cookie org when the user is a member of it', () => {
    expect(resolveActiveOrgId(ORGS, 'org-b')).toBe('org-b');
  });

  it('falls back to the first org when the cookie names a non-member org', () => {
    expect(resolveActiveOrgId(ORGS, 'org-x')).toBe('org-a');
  });

  it('falls back to the first org when the cookie is absent', () => {
    expect(resolveActiveOrgId(ORGS, null)).toBe('org-a');
    expect(resolveActiveOrgId(ORGS, undefined)).toBe('org-a');
    expect(resolveActiveOrgId(ORGS, '')).toBe('org-a');
  });

  it('returns null when the user has no orgs', () => {
    expect(resolveActiveOrgId([], 'org-a')).toBeNull();
    expect(resolveActiveOrgId([], null)).toBeNull();
  });
});

describe('isOrgMember', () => {
  it('is true only for an org in the list', () => {
    expect(isOrgMember(ORGS, 'org-c')).toBe(true);
    expect(isOrgMember(ORGS, 'org-x')).toBe(false);
    expect(isOrgMember([], 'org-a')).toBe(false);
  });
});
