import type { Metadata } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getAllClientOrgs, getSubscriptionsByOrg } from '@/lib/portal/orgData';
import { ClientsTable, type ClientRow } from '@/components/internal/ClientsTable';

// Internal clients list (PR13d). Auth + hub chrome live in the /internal layout;
// reads go through the session client so the migration-011 internal_select_*
// RLS policies (is_internal) authorise them — no admin client here.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Clients',
};

export default async function InternalClientsPage() {
  const db = await createSupabaseServerClient();

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
      tierSlug: sub?.tier_slug ?? null,
      subStatus: sub?.status ?? null,
      created_at: o.created_at,
    };
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length} client {rows.length === 1 ? 'organisation' : 'organisations'}. View-only.
        </p>
      </div>

      <ClientsTable rows={rows} />
    </div>
  );
}
