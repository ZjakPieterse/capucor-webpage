import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeJsonRequest } from './helpers/request';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

const { resendSendMock } = vi.hoisted(() => ({
  resendSendMock: vi.fn(async () => ({
    data: { id: 'email_test' },
    error: null,
    headers: null,
  })),
}));
vi.mock('resend', () => ({
  Resend: vi.fn(function (this: { emails: { send: typeof resendSendMock } }) {
    this.emails = { send: resendSendMock };
  }),
}));

import { checkRateLimit } from '@/lib/rate-limit';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { POST } from '@/app/api/data-request/route';

type SupabaseStub = Awaited<ReturnType<typeof createSupabaseServerClient>>;

let insertSpy: ReturnType<typeof vi.fn>;

function mountSupabase(insertImpl: () => Promise<{ error: unknown }> = async () => ({ error: null })) {
  insertSpy = vi.fn(insertImpl);
  vi.mocked(createSupabaseServerClient).mockResolvedValue({
    from: () => ({ insert: insertSpy }),
  } as unknown as SupabaseStub);
}

const validBody = {
  email: 'pat@example.com',
  request_type: 'access' as const,
  consent_given: true as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.RESEND_API_KEY;
  delete process.env.OWNER_NOTIFICATION_EMAIL;
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, retryAfter: 0 });
  mountSupabase();
});

describe('POST /api/data-request', () => {
  it('1. happy path — inserts row with token + expiry, returns 200', async () => {
    const res = await POST(makeJsonRequest('http://test/api/data-request', validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deliveryStatus: 'pending' });
    expect(insertSpy).toHaveBeenCalledTimes(1);

    const inserted = insertSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(inserted.email).toBe('pat@example.com');
    expect(inserted.request_type).toBe('access');
    expect(inserted.status).toBe('pending_confirmation');
    expect(typeof inserted.token).toBe('string');
    expect((inserted.token as string).length).toBeGreaterThan(30);
    expect(typeof inserted.token_expires_at).toBe('string');
    // Expiry should be 24h in the future (within 5 minutes tolerance)
    const expiresMs = new Date(inserted.token_expires_at as string).getTime();
    const targetMs = Date.now() + 24 * 60 * 60 * 1000;
    expect(Math.abs(expiresMs - targetMs)).toBeLessThan(5 * 60 * 1000);
    expect(inserted.consent_version).toBe('v1');
    expect(inserted.consent_language).toBe('en-ZA');
  });

  it('2. honeypot — silently 200s without inserting', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/data-request', {
        ...validBody,
        website: 'http://spam.example',
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('3. rate limited — 429 with Retry-After header, no insert', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      allowed: false,
      retryAfter: 42,
    });
    const res = await POST(makeJsonRequest('http://test/api/data-request', validBody));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
    expect((await res.json()).error).toMatch(/too many requests/i);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('4. malformed JSON — 400', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/data-request', null, {
        raw: '{not json',
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid request body.' });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('5. zod invalid — bogus request_type rejected', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/data-request', {
        ...validBody,
        request_type: 'export',
      }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.field).toBe('request_type');
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('6. zod invalid — consent_given:false rejected', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/data-request', {
        ...validBody,
        consent_given: false,
      }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).field).toBe('consent_given');
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('7. invalid email — 422', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/data-request', {
        ...validBody,
        email: 'not-an-email',
      }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).field).toBe('email');
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('8. supabase insert error — 500', async () => {
    mountSupabase(async () => ({ error: new Error('db boom') }));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(makeJsonRequest('http://test/api/data-request', validBody));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/could not save/i);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('9. no RESEND_API_KEY — falls through to console.log path', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await POST(makeJsonRequest('http://test/api/data-request', validBody));
    expect(res.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[DATA_REQUEST] type=access'));
    expect(resendSendMock).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('10. resend throws — row still saved, 200 returned', async () => {
    process.env.RESEND_API_KEY = 'test_key';
    process.env.OWNER_NOTIFICATION_EMAIL = 'owner@example.com';
    resendSendMock.mockRejectedValueOnce(new Error('resend fail'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(makeJsonRequest('http://test/api/data-request', validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, deliveryStatus: 'pending' });
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(resendSendMock).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      '[EMAIL] delivery pending:',
      expect.objectContaining({ errorCode: 'transport_error' }),
    );
    errorSpy.mockRestore();
  });

  it('11. delete request — sends deletion-flavoured email subject', async () => {
    process.env.RESEND_API_KEY = 'test_key';
    process.env.OWNER_NOTIFICATION_EMAIL = 'owner@example.com';
    const res = await POST(
      makeJsonRequest('http://test/api/data-request', {
        ...validBody,
        request_type: 'delete',
      }),
    );
    expect(res.status).toBe(200);
    const subjects = resendSendMock.mock.calls.map((c) => (c as unknown as [{ subject: string }])[0].subject);
    expect(subjects.some((s) => /deletion/i.test(s))).toBe(true);
    expect(subjects.some((s) => /Data delete request/.test(s))).toBe(true);
  });
});
