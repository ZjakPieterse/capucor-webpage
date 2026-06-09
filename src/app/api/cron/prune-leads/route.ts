/**
 * GET / POST /api/cron/prune-leads
 *
 * POPIA P3 — daily retention job. Deletes leads with status='new' that are
 * older than LEAD_RETENTION_DAYS. Engaged-client leads are excluded by the
 * status filter and retained per the engagement letter.
 *
 * Auth: ?secret=REVALIDATE_SECRET. The Cloudflare cron trigger in
 * wrangler.jsonc fires this URL on a daily schedule.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { LEAD_RETENTION_DAYS } from '@/lib/consent';
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

  const cutoffIso = new Date(
    Date.now() - LEAD_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  try {
    const supabase = createSupabaseAdminClient();
    const { error, count } = await supabase
      .from('leads')
      .delete({ count: 'exact' })
      .eq('status', 'new')
      .lt('created_at', cutoffIso);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      deleted: count ?? 0,
      cutoff: cutoffIso,
      retention_days: LEAD_RETENTION_DAYS,
    });
  } catch (err) {
    console.error('[CRON:prune-leads] failed:', err);
    return NextResponse.json(
      { error: 'Prune failed.' },
      { status: 500 },
    );
  }
}

export const POST = GET;
