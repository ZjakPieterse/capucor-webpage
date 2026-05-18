import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeJsonRequest } from './helpers/request';

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

const { resendSendMock } = vi.hoisted(() => ({
  resendSendMock: vi.fn(async () => ({ id: 'email_test' })),
}));
vi.mock('resend', () => ({
  Resend: vi.fn(function (this: { emails: { send: typeof resendSendMock } }) {
    this.emails = { send: resendSendMock };
  }),
}));

import { checkRateLimit } from '@/lib/rate-limit';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { POST } from '@/app/api/leads/route';

type SupabaseStub = Awaited<ReturnType<typeof createSupabaseServerClient>>;

let insertSpy: ReturnType<typeof vi.fn>;

function mountSupabase(insertImpl: () => Promise<{ error: unknown }> = async () => ({ error: null })) {
  insertSpy = vi.fn(insertImpl);
  vi.mocked(createSupabaseServerClient).mockResolvedValue({
    from: () => ({ insert: insertSpy }),
  } as unknown as SupabaseStub);
}

const validBody = {
  source: 'signup' as const,
  name: 'Pat Patterson',
  email: 'pat@example.com',
  business: 'Pat Co',
  consent_given: true as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.RESEND_API_KEY;
  delete process.env.OWNER_NOTIFICATION_EMAIL;
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, retryAfter: 0 });
  mountSupabase();
});

describe('POST /api/leads', () => {
  it('1. happy path — inserts lead and returns 200', async () => {
    const res = await POST(makeJsonRequest('http://test/api/leads', validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const inserted = insertSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(inserted.name).toBe('Pat Patterson');
    expect(inserted.consent_given).toBe(true);
    expect(typeof inserted.consent_timestamp).toBe('string');
    expect(() => new Date(inserted.consent_timestamp as string).toISOString()).not.toThrow();
  });

  it('2. honeypot — silently 200s without inserting', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/leads', { ...validBody, website: 'http://spam.example' }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('3. rate limited — 429 with Retry-After header, no insert', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, retryAfter: 42 });
    const res = await POST(makeJsonRequest('http://test/api/leads', validBody));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
    expect((await res.json()).error).toMatch(/too many requests/i);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('4. malformed JSON — 400', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/leads', null, { raw: '{not json' }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid request body.' });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('5. zod invalid — missing name returns 422 with field', async () => {
    const { name: _drop, ...withoutName } = validBody;
    const res = await POST(makeJsonRequest('http://test/api/leads', withoutName));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.field).toBe('name');
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('6. zod invalid — consent_given:false returns 422 with field', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/leads', { ...validBody, consent_given: false }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).field).toBe('consent_given');
  });

  it('7. zod invalid — config.brackets with negative number rejected (C4)', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/leads', {
        ...validBody,
        config: {
          services: ['accounting'],
          brackets: { accounting: -1 },
        },
      }),
    );
    expect(res.status).toBe(422);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('8. supabase insert error — 500', async () => {
    mountSupabase(async () => ({ error: new Error('db boom') }));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(makeJsonRequest('http://test/api/leads', validBody));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/could not save/i);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('9. no RESEND_API_KEY — falls through to console.log path', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await POST(makeJsonRequest('http://test/api/leads', validBody));
    expect(res.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[LEAD] source=signup'),
    );
    expect(resendSendMock).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('10. resend throws — lead still saved, 200 returned', async () => {
    process.env.RESEND_API_KEY = 'test_key';
    process.env.OWNER_NOTIFICATION_EMAIL = 'owner@example.com';
    resendSendMock.mockRejectedValueOnce(new Error('resend fail'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(makeJsonRequest('http://test/api/leads', validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(resendSendMock).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[LEADS] Resend notification error:'),
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });
});
