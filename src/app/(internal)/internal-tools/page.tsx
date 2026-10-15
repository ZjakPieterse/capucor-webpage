import type { Metadata } from 'next';
import { tierDisplayName } from '@/config/tiers';
import { requireInternalPage } from '@/lib/internal/guard';
import { logError } from '@/lib/log';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatZAR } from '@/lib/utils';
import { addMonths, plansInForceQuery, type PlanInForce } from '@/lib/internal/plansInForce';

// absolute: a layout's title template does not apply to a page in its own segment.
export const metadata: Metadata = { title: { absolute: 'Plans in force | Capucor internal' } };

const dateFmt = new Intl.DateTimeFormat('en-ZA', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Africa/Johannesburg',
});

// Read-only. A plan is in force when it is signed or active (pre-2026-10-07
// portal provisioning promoted signed plans to 'active') and nothing has
// superseded it (Zjak, 2026-10-15). Review due = signed date + 3 months; the
// last-review date joins once migration 004 (plan_reviews) is applied.
export default async function PlansInForcePage() {
  await requireInternalPage();

  const { data, error } = await plansInForceQuery(createSupabaseAdminClient());
  if (error) logError('internal.plans_in_force_failed', error);
  const plans: PlanInForce[] = data ?? [];
  const now = new Date();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Plans in force</h1>
        <p className="text-sm text-muted-foreground">
          {error ? 'Could not load plans.' : `${plans.length} plans, oldest first.`}
        </p>
      </div>

      {error ? null : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Ref</th>
                <th className="px-3 py-2 font-medium">Business</th>
                <th className="px-3 py-2 font-medium">Tier</th>
                <th className="px-3 py-2 font-medium text-right">Monthly (excl. VAT)</th>
                <th className="px-3 py-2 font-medium">Signed</th>
                <th className="px-3 py-2 font-medium">Review due</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => {
                const signed = p.signed_at ? new Date(p.signed_at) : null;
                const due = signed ? addMonths(signed, 3) : null;
                const overdue = due !== null && due <= now;
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{p.ref_number ?? '—'}</td>
                    <td className="px-3 py-2">{p.business_name}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{tierDisplayName(p.tier_slug)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                      {formatZAR(Number(p.monthly_total_zar))}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{signed ? dateFmt.format(signed) : '—'}</td>
                    <td className={`px-3 py-2 whitespace-nowrap${overdue ? ' font-semibold' : ''}`}>
                      {due ? dateFmt.format(due) : '—'}
                      {overdue ? ' (due)' : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
