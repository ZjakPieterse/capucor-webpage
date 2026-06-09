import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeJsonRequest } from './helpers/request';

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
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

import { checkRateLimit } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { POST } from '@/app/api/proposals/sign/route';

// A real (tiny) 1×1 PNG data URL — passes the prefix regex and decodes small.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 1000).toISOString();

// Mutable per-test state, read at call time by the from() closures below.
let lookupResult: { data: Record<string, unknown> | null; error: unknown };
let updateResult: { error: unknown };
let updateRows: { id: string }[];
const updatePayloads: Record<string, unknown>[] = [];

function viewedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prop_1',
    first_name: 'Pat',
    last_name: 'Patterson',
    business_name: 'Pat Trading Co',
    email: 'pat@example.com',
    status: 'viewed',
    expires_at: FUTURE,
    ...overrides,
  };
}

// Chainable update stub: supports both the status-guarded sign update
// (.eq().in().select() → rows) and the awaited sent-at update (.eq() → result).
interface UpdateBuilder {
  eq: () => UpdateBuilder;
  in: () => UpdateBuilder;
  select: () => Promise<{ data: { id: string }[] | null; error: unknown }>;
  then: (
    onFulfilled: (v: { error: unknown }) => unknown,
    onRejected?: (e: unknown) => unknown,
  ) => Promise<unknown>;
}

const proposalUpdate = vi.fn((payload: Record<string, unknown>) => {
  updatePayloads.push(payload);
  const builder: UpdateBuilder = {
    eq: () => builder,
    in: () => builder,
    select: async () => ({
      data: updateResult.error ? null : updateRows,
      error: updateResult.error,
    }),
    then: (onFulfilled, onRejected) =>
      Promise.resolve(updateResult).then(onFulfilled, onRejected),
  };
  return builder;
});

function mountAdmin() {
  vi.mocked(createSupabaseAdminClient).mockReturnValue({
    from: (table: string) => {
      if (table !== 'proposals') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => lookupResult }) }),
        update: proposalUpdate,
      };
    },
  } as unknown as ReturnType<typeof createSupabaseAdminClient>);
}

const validBody = {
  token: 'a'.repeat(32),
  signatureName: 'Pat Patterson',
  method: 'typed' as const,
  imageDataUrl: PNG,
  consentGiven: true as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  updatePayloads.length = 0;
  lookupResult = { data: viewedRow(), error: null };
  updateResult = { error: null };
  updateRows = [{ id: 'prop_1' }];
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, retryAfter: 0 });
  sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null });
  process.env.RESEND_API_KEY = 're_test';
  process.env.OWNER_NOTIFICATION_EMAIL = 'owner@capucor.com';
  mountAdmin();
});

describe('POST /api/proposals/sign', () => {
  it('1. happy path (typed) — flips to signed, records the signature, emails both', async () => {
    const res = await POST(makeJsonRequest('http://test/api/proposals/sign', validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });

    const payload = updatePayloads[0]!;
    expect(payload).toMatchObject({
      status: 'signed',
      signature_name: 'Pat Patterson',
      signature_method: 'typed',
      signature_image: PNG,
      signature_ip: '203.0.113.1',
    });
    expect(typeof payload.signed_at).toBe('string');

    // Client + owner confirmation emails.
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('2. happy path (drawn)', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals/sign', { ...validBody, method: 'drawn' }),
    );
    expect(res.status).toBe(200);
    expect(updatePayloads[0]!.signature_method).toBe('drawn');
  });

  it('3. happy path (uploaded)', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals/sign', { ...validBody, method: 'uploaded' }),
    );
    expect(res.status).toBe(200);
    expect(updatePayloads[0]!.signature_method).toBe('uploaded');
  });

  it('4. honeypot — silently succeeds, no DB calls', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals/sign', {
        ...validBody,
        website: 'http://spam.example',
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it('5. rate limited — 429 with Retry-After, no DB calls', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, retryAfter: 23 });
    const res = await POST(makeJsonRequest('http://test/api/proposals/sign', validBody));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('23');
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it('6. malformed JSON — 400', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals/sign', null, { raw: '{nope' }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid request body.' });
  });

  it('7. zod — missing signatureName returns 422 with field', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals/sign', { ...validBody, signatureName: '' }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).field).toBe('signatureName');
  });

  it('8. zod — consentGiven:false returns 422 with field', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals/sign', { ...validBody, consentGiven: false }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).field).toBe('consentGiven');
  });

  it('9. zod — bad method returns 422 with field', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals/sign', { ...validBody, method: 'stamp' }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).field).toBe('method');
  });

  it('10. zod — non-image data URL returns 422 on imageDataUrl', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals/sign', {
        ...validBody,
        imageDataUrl: 'data:text/plain;base64,aGVsbG8=',
      }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).field).toBe('imageDataUrl');
  });

  it('11. oversized image — server byte guard returns 422 on imageDataUrl', async () => {
    // ~540 KB decoded: passes the zod char cap (<750k chars) but exceeds the
    // 512 KB decoded byte guard in the route.
    const big = 'data:image/png;base64,' + 'A'.repeat(720_000);
    const res = await POST(
      makeJsonRequest('http://test/api/proposals/sign', { ...validBody, imageDataUrl: big }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).field).toBe('imageDataUrl');
    expect(proposalUpdate).not.toHaveBeenCalled();
  });

  it('12. unknown token — 404, no update', async () => {
    lookupResult = { data: null, error: null };
    const res = await POST(makeJsonRequest('http://test/api/proposals/sign', validBody));
    expect(res.status).toBe(404);
    expect(proposalUpdate).not.toHaveBeenCalled();
  });

  it('13. already signed — 409, no update', async () => {
    lookupResult = { data: viewedRow({ status: 'signed' }), error: null };
    const res = await POST(makeJsonRequest('http://test/api/proposals/sign', validBody));
    expect(res.status).toBe(409);
    expect(proposalUpdate).not.toHaveBeenCalled();
  });

  it('14. expired by status — 410, no update', async () => {
    lookupResult = { data: viewedRow({ status: 'expired' }), error: null };
    const res = await POST(makeJsonRequest('http://test/api/proposals/sign', validBody));
    expect(res.status).toBe(410);
    expect(proposalUpdate).not.toHaveBeenCalled();
  });

  it('15. expired by date — 410, no update', async () => {
    lookupResult = { data: viewedRow({ expires_at: PAST }), error: null };
    const res = await POST(makeJsonRequest('http://test/api/proposals/sign', validBody));
    expect(res.status).toBe(410);
    expect(proposalUpdate).not.toHaveBeenCalled();
  });

  it('16. lookup error — 500', async () => {
    lookupResult = { data: null, error: new Error('db boom') };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(makeJsonRequest('http://test/api/proposals/sign', validBody));
    expect(res.status).toBe(500);
    expect(proposalUpdate).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('17. update error — 500', async () => {
    updateResult = { error: new Error('update boom') };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(makeJsonRequest('http://test/api/proposals/sign', validBody));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/record your signature/i);
    errorSpy.mockRestore();
  });

  it('18. Resend throws — signature still saved, returns 200', async () => {
    sendMock.mockRejectedValueOnce(new Error('resend down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(makeJsonRequest('http://test/api/proposals/sign', validBody));
    expect(res.status).toBe(200);
    expect(updatePayloads[0]!.status).toBe('signed');
    errorSpy.mockRestore();
  });

  it('19. lost race — status changed between read and write returns 409, no emails', async () => {
    // The guarded update matches zero rows (e.g. a concurrent sign or the
    // expiry cron got there first).
    updateRows = [];
    const res = await POST(makeJsonRequest('http://test/api/proposals/sign', validBody));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already been signed/i);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
