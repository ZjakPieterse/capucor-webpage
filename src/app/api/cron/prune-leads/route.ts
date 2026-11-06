/**
 * GET / POST /api/cron/prune-leads
 *
 * POPIA s14: the daily retention job. Despite the path (kept so the GitHub
 * Actions cron in .github/workflows/cron-prune-leads.yml needs no change), it
 * now prunes every retained record type: stale 'new' leads, unsigned
 * proposals, data requests and finished email delivery records. The rules and
 * periods are in src/lib/retention.ts and src/lib/consent.ts, and /privacy
 * states them.
 *
 * Responds 500 when any step failed (the workflow then fails and shows the
 * body), with per-table counts either way.
 *
 * Auth: ?secret=REVALIDATE_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { runRetention } from '@/lib/retention';
import { timingSafeEqual } from '@/lib/security';

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (
    !process.env.REVALIDATE_SECRET ||
    !secret ||
    !timingSafeEqual(secret, process.env.REVALIDATE_SECRET)
  ) {
    return NextResponse.json({ error: 'Invalid secret.' }, { status: 401 });
  }

  let result;
  try {
    result = await runRetention(createSupabaseAdminClient());
  } catch (err) {
    console.error('[CRON:prune-leads] failed:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Prune failed.' }, { status: 500 });
  }

  const failed = Object.entries(result).filter(([, step]) => step.error);
  if (failed.length > 0) {
    console.error('[CRON:prune-leads] steps failed:', failed.map(([name, step]) => `${name}: ${step.error}`).join('; '));
  }
  return NextResponse.json({ ok: failed.length === 0, ...result }, { status: failed.length ? 500 : 200 });
}

export const POST = GET;
