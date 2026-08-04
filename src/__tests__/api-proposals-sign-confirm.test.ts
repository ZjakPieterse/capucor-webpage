import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeJsonRequest } from './helpers/request';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
}));
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock('@/lib/portal/fulfilment', () => ({
  processProposalFulfilment: vi.fn(),
}));

import { checkRateLimit } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { processProposalFulfilment } from '@/lib/portal/fulfilment';
import { POST } from '@/app/api/proposals/sign/confirm/route';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const CFUTURE = new Date(Date.now() + 25 * 60 * 1000).toISOString();
const CPAST = new Date(Date.now() - 1000).toISOString();
const CTOKEN = 'c'.repeat(40);

let lookupResult: { data: Record<string, unknown> | null; error: unknown };
let commitResult: { data: { proposal_id: string }[] | null; error: unknown };
const rpc = vi.fn();

function pendingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    token: 'a'.repeat(32),
    ref_number: 'FT-2026-06-0001',
    first_name: 'Pat',
    last_name: 'Patterson',
    business_name: 'Pat Trading Co',
    email: 'pat@example.com',
    status: 'viewed',
    expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    services: ['accounting'],
    brackets: { accounting: 0 },
    tier_slug: 'pro',
    addons: [],
    monthly_total_zar: 1325,
    vat_zar: 0,
    total_charge_zar: 1325,
    client_org_id: null,
    sign_confirm_expires_at: CFUTURE,
    pending_signature_name: 'Pat Patterson',
    pending_signature_method: 'typed',
    pending_signature_image: PNG,
    pending_signature_ip: '203.0.113.1',
    ...overrides,
  };
}

function mountAdmin() {
  rpc.mockImplementation(async (name: string) => {
    if (name !== 'commit_proposal_signature')
      throw new Error(`unexpected RPC ${name}`);
    return commitResult;
  });
  vi.mocked(createSupabaseAdminClient).mockReturnValue({
    from: (table: string) => {
      if (table !== 'proposals') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => lookupResult }),
        }),
      };
    },
    rpc,
  } as unknown as ReturnType<typeof createSupabaseAdminClient>);
}

beforeEach(() => {
  vi.clearAllMocks();
  lookupResult = { data: pendingRow(), error: null };
  commitResult = {
    data: [{ proposal_id: '11111111-1111-4111-8111-111111111111' }],
    error: null,
  };
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, retryAfter: 0 });
  vi.mocked(processProposalFulfilment).mockResolvedValue({
    provisioned: true,
    deliveryStatus: 'accepted',
    completed: true,
  });
  mountAdmin();
});

describe('POST /api/proposals/sign/confirm', () => {
  it('1. atomically commits signature + fulfilment record, then attempts recovery stages', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals/sign/confirm', {
        ctoken: CTOKEN,
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      provisioned: true,
      deliveryStatus: 'accepted',
    });
    expect(rpc).toHaveBeenCalledWith(
      'commit_proposal_signature',
      expect.objectContaining({
        p_proposal_id: '11111111-1111-4111-8111-111111111111',
        p_confirm_token: CTOKEN,
        p_signed_at: expect.any(String),
      }),
    );
    expect(processProposalFulfilment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: '11111111-1111-4111-8111-111111111111',
        status: 'signed',
        tier_slug: 'pro',
      }),
      expect.any(String),
    );
  });

  it('2. incomplete external work remains a successful legal signature with pending delivery', async () => {
    vi.mocked(processProposalFulfilment).mockResolvedValueOnce({
      provisioned: false,
      deliveryStatus: 'pending',
      completed: false,
    });
    const res = await POST(
      makeJsonRequest('http://test/api/proposals/sign/confirm', {
        ctoken: CTOKEN,
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      provisioned: false,
      deliveryStatus: 'pending',
    });
  });

  it('3. a short token is rejected before database access', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals/sign/confirm', {
        ctoken: 'short',
      }),
    );
    expect(res.status).toBe(400);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it('4. an unknown or consumed token returns 404', async () => {
    lookupResult = { data: null, error: null };
    const res = await POST(
      makeJsonRequest('http://test/api/proposals/sign/confirm', {
        ctoken: CTOKEN,
      }),
    );
    expect(res.status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('5. an expired confirmation is rejected before the commit RPC', async () => {
    lookupResult = {
      data: pendingRow({ sign_confirm_expires_at: CPAST }),
      error: null,
    };
    const res = await POST(
      makeJsonRequest('http://test/api/proposals/sign/confirm', {
        ctoken: CTOKEN,
      }),
    );
    expect(res.status).toBe(410);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('6. an already-signed state is rejected before the commit RPC', async () => {
    lookupResult = { data: pendingRow({ status: 'active' }), error: null };
    const res = await POST(
      makeJsonRequest('http://test/api/proposals/sign/confirm', {
        ctoken: CTOKEN,
      }),
    );
    expect(res.status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('7. a concurrent commit winner returns no row and prevents duplicate fulfilment', async () => {
    commitResult = { data: [], error: null };
    const res = await POST(
      makeJsonRequest('http://test/api/proposals/sign/confirm', {
        ctoken: CTOKEN,
      }),
    );
    expect(res.status).toBe(409);
    expect(processProposalFulfilment).not.toHaveBeenCalled();
  });

  it('8. a missing pending signature cannot be committed', async () => {
    lookupResult = {
      data: pendingRow({
        pending_signature_name: null,
        pending_signature_method: null,
        pending_signature_image: null,
      }),
      error: null,
    };
    const res = await POST(
      makeJsonRequest('http://test/api/proposals/sign/confirm', {
        ctoken: CTOKEN,
      }),
    );
    expect(res.status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('9. rate limiting prevents lookup and commit', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      allowed: false,
      retryAfter: 30,
    });
    const res = await POST(
      makeJsonRequest('http://test/api/proposals/sign/confirm', {
        ctoken: CTOKEN,
      }),
    );
    expect(res.status).toBe(429);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it('10. a commit error is a retryable 500 and does not start external stages', async () => {
    commitResult = {
      data: null,
      error: { code: 'XX000', message: 'database unavailable' },
    };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(
      makeJsonRequest('http://test/api/proposals/sign/confirm', {
        ctoken: CTOKEN,
      }),
    );
    expect(res.status).toBe(500);
    expect(processProposalFulfilment).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
