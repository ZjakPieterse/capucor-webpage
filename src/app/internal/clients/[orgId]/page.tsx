import { notFound } from 'next/navigation';
import { Building2, CreditCard, Users } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireInternal } from '@/lib/auth/requireInternal';
import { getOrgMembers, getOrgRecord, getOrgSubscription } from '@/lib/portal/orgData';
import { SubscriptionStatusBadge } from '@/components/portal/StatusBadge';
import { OrgNamesEditor } from '@/components/internal/OrgNamesEditor';
import { formatZAR } from '@/lib/utils';

const TIER_NAMES: Record<string, string> = {
  basic: 'Basic',
  pro: 'Pro',
  premium: 'Premium',
};

function formatLongDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default async function ClientOverviewPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const db = await createSupabaseServerClient();

  // The /internal layout already gated access; re-read the role here (as the
  // amend page does) to decide whether to show the admin-only names editor.
  const internal = await requireInternal(`/internal/clients/${orgId}`);
  const isAdmin = internal?.role === 'admin';

  const [org, sub, members] = await Promise.all([
    getOrgRecord(db, orgId),
    getOrgSubscription(db, orgId),
    getOrgMembers(db, orgId),
  ]);

  if (!org) notFound();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
          <Building2 className="h-4 w-4 text-primary" />
          Organisation
        </h2>
        <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          <Field label="Display name" value={org.display_name} />
          <Field label="Legal name" value={org.legal_name ?? '—'} />
          <Field label="Reference / slug" value={org.slug} />
          <Field label="Status" value={org.status} className="capitalize" />
          <Field label="Registration no." value={org.business_reg_no ?? '—'} />
          <Field label="Primary contact" value={org.primary_contact_email} />
          <Field label="Created" value={formatLongDate(org.created_at)} />
          <Field
            label="Xero"
            value={org.xero_connected_at ? `Connected ${formatLongDate(org.xero_connected_at)}` : 'Not connected'}
          />
        </dl>

        {isAdmin && (
          <OrgNamesEditor
            orgId={org.id}
            displayName={org.display_name}
            legalName={org.legal_name}
          />
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
          <CreditCard className="h-4 w-4 text-primary" />
          Subscription
        </h2>
        {sub ? (
          <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
            <Field label="Tier" value={TIER_NAMES[sub.tier_slug] ?? sub.tier_slug} />
            <div>
              <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </dt>
              <dd>
                <SubscriptionStatusBadge status={sub.status} />
              </dd>
            </div>
            <Field
              label="Total monthly charge"
              value={formatZAR(Number(sub.total_charge_zar))}
              className="font-mono"
            />
            <Field label="Next billing" value={formatLongDate(sub.current_period_end)} />
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No subscription on file yet.</p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
          <Users className="h-4 w-4 text-primary" />
          Access
        </h2>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No portal users linked yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center justify-between gap-4">
                <span className="font-mono text-xs text-muted-foreground">{m.user_id}</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs capitalize">
                  {m.role}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          {members.length} portal {members.length === 1 ? 'user' : 'users'} linked to this client.
        </p>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className={`font-medium ${className ?? ''}`}>{value}</dd>
    </div>
  );
}
