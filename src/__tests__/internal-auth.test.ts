import { describe, it, expect, beforeEach, vi } from 'vitest';

// redirect() throws in real Next to halt rendering — mirror that so requireInternal
// stops at the redirect and we can assert the target.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireInternal } from '@/lib/auth/requireInternal';

type AuthUser = { id: string; email: string | null } | null;

// Stubs the cookie-bound server client's getUser().
function mockSession(user: AuthUser) {
  (createSupabaseServerClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
  });
}

// Captures the email/active filters the admin lookup is called with, and returns
// the allowlist row (or null) for that query.
const emailEq = vi.fn();
function mockAllowlist(row: { role: string } | null) {
  emailEq.mockClear();
  const builder = {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      if (col === 'email') emailEq(val);
      return builder;
    },
    maybeSingle: async () => ({ data: row, error: null }),
  };
  (createSupabaseAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from: () => builder,
  });
}

const PATH = '/internal/proposals';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireInternal', () => {
  it('redirects to /login (with next) when signed out', async () => {
    mockSession(null);
    mockAllowlist(null);
    await expect(requireInternal(PATH)).rejects.toThrow(
      `REDIRECT:/login?next=${encodeURIComponent(PATH)}`,
    );
    expect(redirect).toHaveBeenCalledOnce();
  });

  it('returns null for a signed-in user who is not on the allowlist', async () => {
    mockSession({ id: 'u1', email: 'client@example.com' });
    mockAllowlist(null);
    await expect(requireInternal(PATH)).resolves.toBeNull();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('returns the admin role for an allowlisted admin', async () => {
    mockSession({ id: 'u2', email: 'zjak@capucor.com' });
    mockAllowlist({ role: 'admin' });
    await expect(requireInternal(PATH)).resolves.toEqual({
      id: 'u2',
      email: 'zjak@capucor.com',
      role: 'admin',
    });
  });

  it('returns the basic role for an allowlisted basic user', async () => {
    mockSession({ id: 'u3', email: 'staff@capucor.com' });
    mockAllowlist({ role: 'basic' });
    await expect(requireInternal(PATH)).resolves.toEqual({
      id: 'u3',
      email: 'staff@capucor.com',
      role: 'basic',
    });
  });

  it('looks the allowlist up by a lowercased email', async () => {
    mockSession({ id: 'u4', email: 'Zjak@Capucor.com' });
    mockAllowlist({ role: 'admin' });
    await requireInternal(PATH);
    expect(emailEq).toHaveBeenCalledWith('zjak@capucor.com');
  });

  it('returns null when the session user has no email', async () => {
    mockSession({ id: 'u5', email: null });
    mockAllowlist(null);
    await expect(requireInternal(PATH)).resolves.toBeNull();
  });
});
