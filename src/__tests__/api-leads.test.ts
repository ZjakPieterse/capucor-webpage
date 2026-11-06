import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeJsonRequest } from './helpers/request';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn() }));
vi.mock('@/lib/email/sendEmail', () => ({
  sendEmail: sendEmailMock,
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
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.RESEND_API_KEY;
  delete process.env.OWNER_NOTIFICATION_EMAIL;
  sendEmailMock.mockResolvedValue({
    deliveryStatus: 'accepted',
    deliveryId: 'delivery_1',
    providerId: 'email_test',
    errorCode: null,
    errorMessage: null,
  });
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, retryAfter: 0 });
  mountSupabase();
});

describe('POST /api/leads', () => {
  it('1. happy path â inserts lead and returns 200', async () => {
    const res = await POST(makeJsonRequest('http://test/api/leads', validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const inserted = insertSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(inserted.name).toBe('Pat Patterson');
    // Privacy notice v2: no consent is asked, so none is written (the column
    // keeps its default); the version records which notice the visitor saw.
    expect(inserted).not.toHaveProperty('consent_given');
    expect(inserted).not.toHaveProperty('consent_timestamp');
    expect(inserted.consent_version).toBe('v4');
    expect(inserted.consent_language).toBe('en-ZA');
  });

  it('2. honeypot â silently 200s without inserting', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/leads', {
        ...validBody,
        website: 'http://spam.example',
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('3. rate limited â 429 with Retry-After header, no insert', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      allowed: false,
      retryAfter: 42,
    });
    const res = await POST(makeJsonRequest('http://test/api/leads', validBody));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');
    expect((await res.json()).error).toMatch(/too many requests/i);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('4. malformed JSON â 400', async () => {
    const res = await POST(makeJsonRequest('http://test/api/leads', null, { raw: '{not json' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid request body.' });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('5. zod invalid â missing name returns 422 with field', async () => {
    const withoutName = {
      source: validBody.source,
      email: validBody.email,
      business: validBody.business,
    };
    const res = await POST(makeJsonRequest('http://test/api/leads', withoutName));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.field).toBe('name');
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('6. a stale page that still sends consent_given is accepted; nothing is stored', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/leads', {
        ...validBody,
        consent_given: true,
      }),
    );
    expect(res.status).toBe(200);
    const inserted = insertSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(inserted).not.toHaveProperty('consent_given');
  });

  it('7. zod invalid â config.brackets with negative number rejected (C4)', async () => {
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

  it('8. supabase insert error â 500', async () => {
    mountSupabase(async () => ({ error: new Error('db boom') }));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(makeJsonRequest('http://test/api/leads', validBody));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/could not save/i);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('9. no owner address set: lead saved, a warning with no personal information', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await POST(makeJsonRequest('http://test/api/leads', validBody));
    expect(res.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('OWNER_NOTIFICATION_EMAIL not set'));
    const logged = [...warnSpy.mock.calls, ...logSpy.mock.calls].flat().join(' ');
    expect(logged).not.toContain(validBody.email);
    expect(logged).not.toContain(validBody.name);
    expect(sendEmailMock).not.toHaveBeenCalled();
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('10. resend throws â lead still saved, 200 returned', async () => {
    process.env.RESEND_API_KEY = 'test_key';
    process.env.OWNER_NOTIFICATION_EMAIL = 'owner@example.com';
    sendEmailMock.mockResolvedValueOnce({
      deliveryStatus: 'pending',
      deliveryId: 'delivery_1',
      providerId: null,
      errorCode: 'transport_error',
      errorMessage: 'resend fail',
    });
    const res = await POST(makeJsonRequest('http://test/api/leads', validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'lead',
        sourceId: expect.any(String),
        eventType: 'lead.owner_notification',
      }),
    );
  });

  const contactAnswers = {
    turnover: 'R1m to R5m',
    teamSize: '6 to 20',
    services: ['Bookkeeping and Xero', 'Payroll'],
    booksNow: 'Another accounting firm',
  };

  it('11. contact answers — stored in leads.config, not as a column', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/leads', { ...validBody, source: 'contact', answers: contactAnswers }),
    );
    expect(res.status).toBe(200);
    const inserted = insertSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(inserted.config).toEqual(contactAnswers);
    expect(inserted).not.toHaveProperty('answers');
  });

  it('12. contact answers — an option not on the list is rejected', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/leads', {
        ...validBody,
        source: 'contact',
        answers: { ...contactAnswers, turnover: 'A billion' },
      }),
    );
    expect(res.status).toBe(422);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
