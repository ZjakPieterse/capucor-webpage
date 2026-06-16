import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireInternalApi } from '@/lib/auth/requireInternalApi';

type AuthUser = { id: string; email: string | null } | null;

function mockSession(user: AuthUser) {
  (createSupabaseServerClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
  });
}

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireInternalApi', () => {
  it('401s when signed out', async () => {
    mockSession(null);
    mockAllowlist(null);
    const result = await requireInternalApi();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it('401s when the session user has no email', async () => {
    mockSession({ id: 'u1', email: null });
    mockAllowlist(null);
    const result = await requireInternalApi();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it('403s for a signed-in user who is not on the allowlist', async () => {
    mockSession({ id: 'u2', email: 'client@example.com' });
    mockAllowlist(null);
    const result = await requireInternalApi();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it('returns the user for any allowlisted internal user when admin is not required', async () => {
    mockSession({ id: 'u3', email: 'staff@capucor.com' });
    mockAllowlist({ role: 'basic' });
    const result = await requireInternalApi();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user).toEqual({
      id: 'u3',
      email: 'staff@capucor.com',
      role: 'basic',
    });
  });

  it('403s a basic user when admin is required', async () => {
    mockSession({ id: 'u4', email: 'staff@capucor.com' });
    mockAllowlist({ role: 'basic' });
    const result = await requireInternalApi({ admin: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it('allows an admin when admin is required', async () => {
    mockSession({ id: 'u5', email: 'zjak@capucor.com' });
    mockAllowlist({ role: 'admin' });
    const result = await requireInternalApi({ admin: true });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user.role).toBe('admin');
  });

  it('looks the allowlist up by a lowercased email', async () => {
    mockSession({ id: 'u6', email: 'Zjak@Capucor.com' });
    mockAllowlist({ role: 'admin' });
    await requireInternalApi({ admin: true });
    expect(emailEq).toHaveBeenCalledWith('zjak@capucor.com');
  });
});
