import { describe, it, expect } from 'vitest';
import {
  normaliseOrgEmails,
  filterProposalsByEmail,
} from '@/lib/internal/clientProposals';

describe('normaliseOrgEmails', () => {
  it('lowercases, trims and de-dupes', () => {
    expect(
      normaliseOrgEmails(['  Owner@Capucor.com ', 'owner@capucor.com', 'TEAM@acme.co.za']),
    ).toEqual(['owner@capucor.com', 'team@acme.co.za']);
  });

  it('drops blanks, nullish and non-emails', () => {
    expect(normaliseOrgEmails([null, undefined, '', '   ', 'not-an-email'])).toEqual([]);
  });

  it('drops values carrying PostgREST or-filter delimiters', () => {
    // Never a real email, but the guard keeps the generated or-filter safe.
    expect(normaliseOrgEmails(['a,b@x.com', 'c(d)@x.com', 'good@x.com'])).toEqual([
      'good@x.com',
    ]);
  });
});

describe('filterProposalsByEmail', () => {
  const rows = [
    { id: '1', email: 'Owner@Capucor.com' },
    { id: '2', email: 'someone@else.com' },
    { id: '3', email: 'owner@capucor.com' },
  ];

  it('selects only rows whose email matches, case-insensitively', () => {
    const out = filterProposalsByEmail(rows, ['owner@capucor.com']);
    expect(out.map((r) => r.id)).toEqual(['1', '3']);
  });

  it('returns nothing when there are no candidate emails', () => {
    expect(filterProposalsByEmail(rows, [])).toEqual([]);
  });
});
