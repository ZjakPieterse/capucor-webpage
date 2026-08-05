import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * /api/health must answer two audiences differently.
 *
 * It used to enumerate every secret this Worker reads — by name,
 * unauthenticated, on the open internet. Values were never exposed and the
 * route touches no database, so this was topology disclosure rather than a
 * breach, but a scanner should not get our configuration surface for free.
 *
 * Two behaviours have to hold at once, and they pull in opposite directions:
 * the public body must name nothing, while CI and uptime monitoring must still
 * be able to tell a configured Worker from a broken one. The 503 is what
 * carries that, so it stays PUBLIC and unweakened — narrowing the body must not
 * turn a missing-secret deploy into a healthy-looking 200.
 */

vi.mock('server-only', () => ({}));

const REQUIRED = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  'REVALIDATE_SECRET',
  'OWNER_NOTIFICATION_EMAIL',
  'APPS_SCRIPT_PDF_URL',
  'APPS_SCRIPT_PDF_SECRET',
];

const SECRET = 'test-service-role-key';

async function sign(timestamp: string, secret = SECRET): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.health`),
  );
  return [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function request(headers: Record<string, string> = {}) {
  return new NextRequest('http://test/api/health', { method: 'GET', headers });
}

let GET: (req: NextRequest) => Promise<Response>;

beforeEach(async () => {
  vi.resetModules();
  for (const name of REQUIRED) process.env[name] = 'set';
  process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
  ({ GET } = await import('@/app/api/health/route'));
});

afterEach(() => {
  for (const name of REQUIRED) delete process.env[name];
});

describe('GET /api/health', () => {
  it('1. public response names nothing — only { ok, app }', async () => {
    const res = await GET(request());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ ok: true, app: 'capucor-web' });

    // Belt and braces: no secret name may appear anywhere in the payload.
    const raw = JSON.stringify(body);
    for (const name of REQUIRED) expect(raw).not.toContain(name);
  });

  it('2. a valid signature unlocks the per-variable detail', async () => {
    const ts = String(Date.now());
    const res = await GET(
      request({
        'x-capucor-timestamp': ts,
        'x-capucor-signature': await sign(ts),
      }),
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.app).toBe('capucor-web');
    expect(body.missing).toEqual([]);
    for (const name of REQUIRED) expect(body.env[name]).toBe(true);
  });

  it('3. a wrong signature gets the public view, not a 401', async () => {
    const ts = String(Date.now());
    const res = await GET(
      request({
        'x-capucor-timestamp': ts,
        'x-capucor-signature': await sign(ts, 'the-wrong-key'),
      }),
    );
    // Still a health check: it answers, it just does not elaborate.
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, app: 'capucor-web' });
  });

  it('4. a stale timestamp is refused even with a correct signature', async () => {
    const ts = String(Date.now() - 10 * 60_000);
    const res = await GET(
      request({
        'x-capucor-timestamp': ts,
        'x-capucor-signature': await sign(ts),
      }),
    );
    expect(await res.json()).toEqual({ ok: true, app: 'capucor-web' });
  });

  it('5. a missing secret still 503s PUBLICLY, without naming it', async () => {
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
    ({ GET } = await import('@/app/api/health/route'));

    const res = await GET(request());
    // This is what CI and uptime monitoring key on. Narrowing the body must
    // never soften it into a 200.
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body).toEqual({ ok: false, app: 'capucor-web' });
    expect(JSON.stringify(body)).not.toContain('RESEND_API_KEY');
  });

  it('6. the signed view still names what is missing, for CI diagnostics', async () => {
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
    ({ GET } = await import('@/app/api/health/route'));

    const ts = String(Date.now());
    const res = await GET(
      request({
        'x-capucor-timestamp': ts,
        'x-capucor-signature': await sign(ts),
      }),
    );
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.missing).toContain('RESEND_API_KEY');
    expect(body.env.RESEND_API_KEY).toBe(false);
  });
});
