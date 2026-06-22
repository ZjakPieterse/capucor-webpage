import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireInternal } from '@/lib/auth/requireInternal';
import { getAllClientOrgs, getSubscriptionsByOrg } from '@/lib/portal/orgData';
import { ClientsTable, type ClientRow } from '@/components/internal/ClientsTable';
import { Button } from '@/components/ui/button';

// Internal clients list (PR13d). Auth + hub chrome live in the /internal layout;
// reads go through the session client so the migration-011 internal_select_*
// RLS policies (is_internal) authorise them — no admin client here.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Clients',
};

export default async function InternalClientsPage() {
  const db = await createSupabaseServerClient();
  const internal = await requireInternal('/internal/clients');
  const isAdmin = internal?.role === 'admin';

  const orgs = await getAllClientOrgs(db);
  const subs = await getSubscriptionsByOrg(
    db,
    orgs.map((o) => o.id),
  );

  const rows: ClientRow[] = orgs.map((o) => {
    const sub = subs.get(o.id);
    return {
      id: o.id,
      name: o.display_name,
      primary_contact_email: o.primary_contact_email,
      status: o.status,
      clientType: o.client_type,
      // For a manually-recorded plan the calculator can't express, the free-text
      // plan_label is the human name; calculator-driven subs fall back to tier_slug.
      tierSlug: sub ? (sub.plan_label ?? sub.tier_slug) : null,
      subStatus: sub?.status ?? null,
      created_at: o.created_at,
    };
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} client {rows.length === 1 ? 'organisation' : 'organisations'}. View-only.
          </p>
        </div>
        {isAdmin && (
          <Button nativeButton={false} render={<Link href="/internal/clients/new" />} size="sm">
            <Plus className="h-4 w-4" />
            Add client
          </Button>
        )}
      </div>

      <ClientsTable rows={rows} />
    </div>
  );
}
