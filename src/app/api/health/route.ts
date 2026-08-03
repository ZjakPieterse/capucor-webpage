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
 * 503 on a missing required secret, so uptime monitoring and the CI post-deploy
 * step both fail loudly instead of reporting a healthy-looking 200.
 */

import { NextResponse } from 'next/server';
import { checkRuntimeEnv } from '@/lib/env';

// Per-request: a cached health check is a lie. Also keeps it off the ISR path.
export const dynamic = 'force-dynamic';

export async function GET() {
  const env = checkRuntimeEnv();

  return NextResponse.json(
    {
      ok: env.ok,
      app: 'capucor-web',
      env: env.checks,
      missing: env.missing,
    },
    {
      status: env.ok ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
