/**
 * GET / POST /api/cron/expire-proposals
 *
 * Proposal-flow PR11 — proactive expiry sweep. Marks any proposal whose
 * expires_at has passed and is still in a live state (sent / viewed) as
 * 'expired', so status queries, the central inbox and any future listings stay
 * accurate without waiting for the client to re-open the link.
 *
 * The /proposal/<token> page already lazily expires the single row it loads;
 * this sweeps every other stale row on a daily schedule.
 *
 * Auth: ?secret=REVALIDATE_SECRET. Driven by the GitHub Actions cron in
 * .github/workflows/cron-expire-proposals.yml (OpenNext for Cloudflare emits a
 * fetch-only Worker with no scheduled() hook — same reason as prune-leads).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
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

  const nowIso = new Date().toISOString();

  try {
    const supabase = createSupabaseAdminClient();
    const { error, count } = await supabase
      .from('proposals')
      .update({ status: 'expired' }, { count: 'exact' })
      .in('status', ['sent', 'viewed'])
      .not('expires_at', 'is', null)
      .lt('expires_at', nowIso);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      expired: count ?? 0,
      as_of: nowIso,
    });
  } catch (err) {
    console.error('[CRON:expire-proposals] failed:', err);
    return NextResponse.json({ error: 'Expiry sweep failed.' }, { status: 500 });
  }
}

export const POST = GET;
