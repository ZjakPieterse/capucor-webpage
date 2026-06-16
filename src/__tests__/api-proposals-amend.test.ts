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
import { POST } from '@/app/api/proposals/amend/route';

// Pro prices: accounting ordinal 1 = 950, payroll ordinal 1 = 600 → 1550 monthly
const PRO_BRACKETS = [
  { service_slug: 'accounting', ordinal: 1, label: '0–1 Mil', basic_price: 725, pro_price: 950, premium_price: 1525 },
  { service_slug: 'payroll', ordinal: 1, label: '1 employee', basic_price: 450, pro_price: 600, premium_price: 950 },
];

const ORIGINAL = {
  id: '11111111-1111-4111-8111-111111111111',
  lead_id: 'lead_1',
  first_name: 'Pat',
  last_name: 'Patterson',
  business_name: 'Pat Trading Co',
  email: 'pat@example.com',
  version: 1,
  status: 'sent',
  consent_version: 'v1',
  consent_language: 'en-ZA',
};

let originalRow: typeof ORIGINAL | null = ORIGINAL;
const insertSpy = vi.fn();
const updateSpy = vi.fn();

function mountAdmin() {
  vi.mocked(createSupabaseAdminClient).mockReturnValue({
    from: (table: string) => {
      if (table === 'brackets') {
        return {
          select: () => ({
            in: () => ({ returns: async () => ({ data: PRO_BRACKETS, error: null }) }),
          }),
        };
      }
      if (table === 'proposals') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: originalRow, error: null }) }),
          }),
          insert: (payload: Record<string, unknown>) => {
            insertSpy(payload);
            return {
              select: () => ({
                single: async () => ({
                  data: { id: 'new_id', ref_number: 'FT-2026-06-0002' },
                  error: null,
                }),
              }),
            };
          },
          update: (payload: Record<string, unknown>) => {
            updateSpy(payload);
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as ReturnType<typeof createSupabaseAdminClient>);
}

const validBody = {
  proposalId: ORIGINAL.id,
  services: ['accounting', 'payroll'],
  brackets: { accounting: 1, payroll: 1 },
  tierSlug: 'pro',
};

function asAdmin() {
  vi.mocked(requireInternalApi).mockResolvedValue({
    ok: true,
    user: { id: 'u1', email: 'zjak@capucor.com', role: 'admin' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  originalRow = ORIGINAL;
  sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null });
  mountAdmin();
});

describe('POST /api/proposals/amend — auth gate', () => {
  it('returns the gate response when the caller is not an internal admin', async () => {
    vi.mocked(requireInternalApi).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Admin access required.' }, { status: 403 }),
    });
    const res = await POST(makeJsonRequest('http://test/api/proposals/amend', validBody));
    expect(res.status).toBe(403);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('401s when signed out', async () => {
    vi.mocked(requireInternalApi).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Not signed in.' }, { status: 401 }),
    });
    const res = await POST(makeJsonRequest('http://test/api/proposals/amend', validBody));
    expect(res.status).toBe(401);
  });

  it('requires admin (passes { admin: true } to the gate)', async () => {
    asAdmin();
    await POST(makeJsonRequest('http://test/api/proposals/amend', validBody));
    expect(requireInternalApi).toHaveBeenCalledWith({ admin: true });
  });
});

describe('POST /api/proposals/amend — admin happy path', () => {
  it('issues a new revision and supersedes the original', async () => {
    asAdmin();
    const res = await POST(makeJsonRequest('http://test/api/proposals/amend', validBody));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.version).toBe(2);
    expect(json.ref_number).toBe('FT-2026-06-0002');

    // New row: bumped version, recomputed total (server-side), supersedes link.
    expect(insertSpy).toHaveBeenCalledOnce();
    const inserted = insertSpy.mock.calls[0][0];
    expect(inserted.version).toBe(2);
    expect(inserted.supersedes_id).toBe(ORIGINAL.id);
    expect(inserted.status).toBe('sent');
    expect(inserted.monthly_total_zar).toBe(1550);
    expect(inserted.first_name).toBe('Pat'); // carried from original

    // Original marked superseded + linked forward.
    expect(updateSpy).toHaveBeenCalledOnce();
    expect(updateSpy.mock.calls[0][0]).toMatchObject({
      status: 'superseded',
      superseded_by_id: 'new_id',
    });
  });

  it('409s when the proposal is already superseded', async () => {
    asAdmin();
    originalRow = { ...ORIGINAL, status: 'superseded' };
    const res = await POST(makeJsonRequest('http://test/api/proposals/amend', validBody));
    expect(res.status).toBe(409);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('404s when the proposal does not exist', async () => {
    asAdmin();
    originalRow = null;
    const res = await POST(makeJsonRequest('http://test/api/proposals/amend', validBody));
    expect(res.status).toBe(404);
  });

  it('422s an invalid body', async () => {
    asAdmin();
    const res = await POST(
      makeJsonRequest('http://test/api/proposals/amend', { proposalId: 'not-a-uuid' }),
    );
    expect(res.status).toBe(422);
  });
});
