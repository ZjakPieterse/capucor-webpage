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

/** Calendar months, clamped to the month's last day (31 Nov → 30 Nov). UTC fields. */
export function addMonths(d: Date, months: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(y, m, Math.min(d.getUTCDate(), last), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()),
  );
}
