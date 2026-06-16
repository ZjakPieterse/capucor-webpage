import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextResponse } from 'next/server';
import { makeJsonRequest } from './helpers/request';

vi.mock('@/lib/auth/requireInternalApi', () => ({
  requireInternalApi: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}));

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

import { requireInternalApi } from '@/lib/auth/requireInternalApi';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { POST } from '@/app/api/proposals/resend/route';

const ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  ref_number: 'FT-2026-06-0001',
  first_name: 'Pat',
  business_name: 'Pat Trading Co',
  email: 'pat@example.com',
  status: 'sent',
  monthly_total_zar: 1550,
};

let row: typeof ROW | null = ROW;
const updateSpy = vi.fn();

function mountAdmin() {
  vi.mocked(createSupabaseAdminClient).mockReturnValue({
    from: (table: string) => {
      if (table !== 'proposals') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }),
        }),
        update: (payload: Record<string, unknown>) => {
          updateSpy(payload);
          return { eq: async () => ({ error: null }) };
        },
      };
    },
  } as unknown as ReturnType<typeof createSupabaseAdminClient>);
}

const validBody = { proposalId: ROW.id };

function asAdmin() {
  vi.mocked(requireInternalApi).mockResolvedValue({
    ok: true,
    user: { id: 'u1', email: 'zjak@capucor.com', role: 'admin' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  row = ROW;
  sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null });
  mountAdmin();
});

describe('POST /api/proposals/resend — auth gate', () => {
  it('returns the gate response for a non-admin caller', async () => {
    vi.mocked(requireInternalApi).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Admin access required.' }, { status: 403 }),
    });
    const res = await POST(makeJsonRequest('http://test/api/proposals/resend', validBody));
    expect(res.status).toBe(403);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('requires admin (passes { admin: true } to the gate)', async () => {
    asAdmin();
    await POST(makeJsonRequest('http://test/api/proposals/resend', validBody));
    expect(requireInternalApi).toHaveBeenCalledWith({ admin: true });
  });
});

describe('POST /api/proposals/resend — admin happy path', () => {
  it('issues a fresh token and resets the status to sent', async () => {
    asAdmin();
    const res = await POST(makeJsonRequest('http://test/api/proposals/resend', validBody));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.ref_number).toBe('FT-2026-06-0001');

    expect(updateSpy).toHaveBeenCalledOnce();
    const updated = updateSpy.mock.calls[0][0];
    expect(updated.status).toBe('sent');
    expect(updated.viewed_at).toBeNull();
    expect(typeof updated.token).toBe('string');
  });

  it('409s a proposal that is not in a resendable status', async () => {
    asAdmin();
    row = { ...ROW, status: 'signed' };
    const res = await POST(makeJsonRequest('http://test/api/proposals/resend', validBody));
    expect(res.status).toBe(409);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('404s when the proposal does not exist', async () => {
    asAdmin();
    row = null;
    const res = await POST(makeJsonRequest('http://test/api/proposals/resend', validBody));
    expect(res.status).toBe(404);
  });
});
