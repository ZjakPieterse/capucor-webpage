/**
 * GET /api/health
 *
 * Proves this Worker is actually CONFIGURED, not merely serving pages.
 *
 * The distinction matters most here. Marketing pages are static and render
 * perfectly with every secret absent, so "capucor.com is up" says nothing about
 * whether a client can receive a proposal, sign it, or be provisioned. Several
 * of this Worker's failures are silent by design — PR10's PDF archival no-ops
 * when APPS_SCRIPT_PDF_* is unset, and Resend falls back to console logging —
 * so the first sign of trouble would otherwise be a client asking where their
 * email went.
 *
 * DISCLOSURE. Presence booleans only, never values. It touches no database and
 * builds no privileged client, so it cannot be used to drive load or cost.
 *
 * Even so, the PUBLIC response is `{ ok, app }`. It used to enumerate every
 * secret this Worker reads by name, unauthenticated, on the open internet —
 * topology a scanner should not get for free. The per-variable detail now needs
 * a signature (lib/healthAuth.ts); it is the same answer, not a weaker one.
 *
 * 503 on a missing required secret, so uptime monitoring and the CI post-deploy
 * step both fail loudly instead of reporting a healthy-looking 200. That is
 * deliberately unchanged and stays on the PUBLIC response: `ok` and the status
 * code carry it, and neither names anything.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRuntimeEnv } from '@/lib/env';
import { verifyHealthSignature } from '@/lib/healthAuth';

// Per-request: a cached health check is a lie. Also keeps it off the ISR path.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const env = checkRuntimeEnv();

  // Absent or malformed headers short-circuit before any crypto work.
  const detailed = await verifyHealthSignature(
    req.headers.get('x-capucor-timestamp'),
    req.headers.get('x-capucor-signature'),
  );

  return NextResponse.json(
    detailed
      ? {
          ok: env.ok,
          app: 'capucor-web',
          env: env.checks,
          missing: env.missing,
        }
      : { ok: env.ok, app: 'capucor-web' },
    {
      status: env.ok ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
