import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}));

const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn() }));
vi.mock('@/lib/email/sendEmail', () => ({
  sendEmail: sendEmailMock,
}));

import { checkRateLimit } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { GET } from '@/app/api/data-request/confirm/route';

const TOKEN = 'a'.repeat(32);
const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 1000).toISOString();

// Mutable per-test state, read at call time by the from() closures below.
let lookupResult: { data: Record<string, unknown> | null; error: unknown };
let updateRows: { id: string }[];
const updatePayloads: Record<string, unknown>[] = [];

function pendingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dr_1',
    email: 'person@example.com',
    request_type: 'access',
    status: 'pending_confirmation',
    token_expires_at: FUTURE,
    ...overrides,
  };
}

// Chainable update stub: supports the status-guarded confirm update
// (.eq().eq().select() → rows) and the awaited expiry update (.eq() → result).
interface UpdateBuilder {
  eq: () => UpdateBuilder;
  select: () => Promise<{ data: { id: string }[] | null; error: unknown }>;
  then: (onFulfilled: (v: { error: unknown }) => unknown, onRejected?: (e: unknown) => unknown) => Promise<unknown>;
}

function mountAdmin() {
  vi.mocked(createSupabaseAdminClient).mockReturnValue({
    from: (table: string) => {
      if (table !== 'data_requests') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => lookupResult }),
        }),
        update: (payload: Record<string, unknown>) => {
          updatePayloads.push(payload);
          const builder: UpdateBuilder = {
            eq: () => builder,
            select: async () => ({ data: updateRows, error: null }),
            then: (onFulfilled, onRejected) => Promise.resolve({ error: null }).then(onFulfilled, onRejected),
          };
          return builder;
        },
      };
    },
  } as unknown as ReturnType<typeof createSupabaseAdminClient>);
}

function makeConfirmRequest(token: string | null): NextRequest {
  const url = token ? `http://test/api/data-request/confirm?token=${token}` : 'http://test/api/data-request/confirm';
  return new NextRequest(url, {
    headers: { 'x-forwarded-for': '203.0.113.1' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  updatePayloads.length = 0;
  lookupResult = { data: pendingRow(), error: null };
  updateRows = [{ id: 'dr_1' }];
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, retryAfter: 0 });
  delete process.env.OWNER_NOTIFICATION_EMAIL;
  sendEmailMock.mockResolvedValue({
    deliveryStatus: 'accepted',
    deliveryId: 'delivery_1',
    providerId: 'email_1',
    errorCode: null,
    errorMessage: null,
  });
  mountAdmin();
});

describe('GET /api/data-request/confirm', () => {
  it('1. happy path — confirms the request with a status-guarded update', async () => {
    const res = await GET(makeConfirmRequest(TOKEN));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Request confirmed');
    expect(updatePayloads[0]).toMatchObject({ status: 'confirmed' });
  });

  it('2. rate limited — 429, no DB calls', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      allowed: false,
      retryAfter: 42,
    });
    const res = await GET(makeConfirmRequest(TOKEN));
    expect(res.status).toBe(429);
    expect(await res.text()).toContain('Too many attempts');
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it('3. lost race — zero rows updated renders the already-confirmed page', async () => {
    updateRows = [];
    const res = await GET(makeConfirmRequest(TOKEN));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Already confirmed');
  });

  it('4. missing/short token — invalid page, no DB calls', async () => {
    const res = await GET(makeConfirmRequest('short'));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Invalid link');
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it('5. unknown token — invalid page', async () => {
    lookupResult = { data: null, error: null };
    const res = await GET(makeConfirmRequest(TOKEN));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Invalid link');
  });

  it('6. already confirmed — already page, no update', async () => {
    lookupResult = { data: pendingRow({ status: 'confirmed' }), error: null };
    const res = await GET(makeConfirmRequest(TOKEN));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Already confirmed');
    expect(updatePayloads).toHaveLength(0);
  });

  it('7. expired token — expired page, row flipped to expired', async () => {
    lookupResult = {
      data: pendingRow({ token_expires_at: PAST }),
      error: null,
    };
    const res = await GET(makeConfirmRequest(TOKEN));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Link expired');
    expect(updatePayloads[0]).toMatchObject({ status: 'expired' });
  });

  it('8. owner notification uses the durable data-request event identity', async () => {
    process.env.OWNER_NOTIFICATION_EMAIL = 'owner@capucor.com';
    const res = await GET(makeConfirmRequest(TOKEN));

    expect(res.status).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'data_request',
        sourceId: 'dr_1',
        eventType: 'data_request.confirmed_owner',
        idempotencyKey: 'capucor_web_data_request_confirmed_owner_dr_1',
      }),
    );
  });
});
