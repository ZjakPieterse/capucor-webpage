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

/** A plausible full git SHA — deploy.yml compares this exactly. */
const RELEASE = '4c9c5c7a1b2d3e4f5061728394a5b6c7d8e9f001';

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
  process.env.CAPUCOR_RELEASE = RELEASE;
  ({ GET } = await import('@/app/api/health/route'));
});

afterEach(() => {
  for (const name of REQUIRED) delete process.env[name];
  delete process.env.CAPUCOR_RELEASE;
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

    // The release is NOT public, and this repo is the PUBLIC marketing site:
    // handing an anonymous visitor our repository state is a disclosure
    // decision nobody has taken, and it is exactly the topology the public
    // body was narrowed to withhold. `toEqual` above already pins the shape;
    // this names the reason so a future edit fails with an explanation.
    expect(body.release).toBeUndefined();
    expect(raw).not.toContain(RELEASE);
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


  it('2a. the signed view reports the exact commit this bundle was built from', async () => {
    // deploy.yml compares this to github.sha with a string equality and fails
    // the run when they differ, so anything less than the full SHA — a prefix,
    // a tag — would make the gate meaningless. See lib/release.ts.
    const ts = String(Date.now());
    const res = await GET(
      request({
        'x-capucor-timestamp': ts,
        'x-capucor-signature': await sign(ts),
      }),
    );

    const body = await res.json();
    expect(body.release).toBe(RELEASE);
    expect(body.release).toHaveLength(40);
  });

  it('2b. a build with no release says so, rather than reporting an empty string', async () => {
    // The MISSING case. An empty string serialises as an answer; "unknown" is
    // one the deploy gate can recognise and report differently from a mismatch.
    delete process.env.CAPUCOR_RELEASE;
    vi.resetModules();
    ({ GET } = await import('@/app/api/health/route'));

    const ts = String(Date.now());
    const res = await GET(
      request({
        'x-capucor-timestamp': ts,
        'x-capucor-signature': await sign(ts),
      }),
    );

    expect((await res.json()).release).toBe('unknown');
  });

  it('2c. a release that is not a full SHA is reported as unknown, not passed through', async () => {
    // The MISMATCHED case, at the point where it can still be caught honestly.
    // A short SHA looks like provenance and cannot be compared exactly, so the
    // deploy gate must see "unknown" rather than a value it might half-match.
    process.env.CAPUCOR_RELEASE = RELEASE.slice(0, 7);
    vi.resetModules();
    ({ GET } = await import('@/app/api/health/route'));

    const ts = String(Date.now());
    const res = await GET(
      request({
        'x-capucor-timestamp': ts,
        'x-capucor-signature': await sign(ts),
      }),
    );

    const body = await res.json();
    expect(body.release).toBe('unknown');
    expect(body.release).not.toBe(RELEASE.slice(0, 7));
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
    const body = await res.json();
    expect(body).toEqual({ ok: true, app: 'capucor-web' });
    // A forged signature must not leak the release either.
    expect(JSON.stringify(body)).not.toContain(RELEASE);
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
