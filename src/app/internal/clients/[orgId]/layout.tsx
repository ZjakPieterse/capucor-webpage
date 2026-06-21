import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getOrgRecord } from '@/lib/portal/orgData';
import { ClientViewTabs } from '@/components/internal/ClientViewTabs';

// View-only mirror of a single client's portal (PR13d). The /internal layout
// already gated access (any internal user); here we resolve the org via the
// session client (RLS is_internal) and provide the shared client-view chrome —
// header + sub-tabs — for every child page. No write affordances, no "act as".
export const dynamic = 'force-dynamic';

export default async function ClientViewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const db = await createSupabaseServerClient();
  const org = await getOrgRecord(db, orgId);

  if (!org) notFound();

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href="/internal/clients"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to clients
      </Link>

      <header className="mb-6">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Client · view-only
        </p>
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{org.display_name}</h1>
          <span className="rounded-full border border-border px-2 py-0.5 text-xs capitalize text-muted-foreground">
            {org.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{org.primary_contact_email}</p>
      </header>

      <ClientViewTabs orgId={orgId} />

      <div className="mt-6">{children}</div>
    </div>
  );
}
