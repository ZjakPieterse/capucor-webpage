import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db';

// Plans in force: signed or active, not superseded (Zjak, 2026-10-15).
// Reads only pre-004 columns, so it works before migration 004 is applied.
export const IN_FORCE_STATUSES = ['signed', 'active'] as const;

export function plansInForceQuery(admin: SupabaseClient<Database>) {
  return admin
    .from('proposals')
    .select('id, ref_number, business_name, tier_slug, monthly_total_zar, signed_at, status')
    .in('status', [...IN_FORCE_STATUSES])
    .is('superseded_by_id', null)
    .order('signed_at', { ascending: true, nullsFirst: true });
}

export type PlanInForce = {
  id: string;
  ref_number: string | null;
  business_name: string;
  tier_slug: string;
  monthly_total_zar: number;
  signed_at: string | null;
  status: string;
};

// South Africa is UTC+2 all year (no DST), so SA calendar maths is UTC maths
// on a shifted clock.
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;

/**
 * Calendar months on the South African calendar, clamped to the month's last
 * day (31 Jan + 3 → 30 Apr). Signed 01:00 SAST on 31 Jan → due 30 Apr, even
 * though that instant is still 30 Jan in UTC.
 */
export function addMonths(d: Date, months: number): Date {
  const sa = new Date(d.getTime() + SAST_OFFSET_MS);
  const y = sa.getUTCFullYear();
  const m = sa.getUTCMonth() + months;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const shifted = Date.UTC(
    y, m, Math.min(sa.getUTCDate(), last), sa.getUTCHours(), sa.getUTCMinutes(), sa.getUTCSeconds(),
  );
  return new Date(shifted - SAST_OFFSET_MS);
}
