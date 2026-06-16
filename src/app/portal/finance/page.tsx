import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getPortalContext } from '@/lib/portal/portalContext';
import { getOrgFinance, type OrgFinance } from '@/lib/portal/orgData';
import { PortalOrgLabel } from '@/components/portal/PortalOrgLabel';
import { FinanceView } from '@/components/portal/FinanceView';

export const metadata: Metadata = {
  title: 'Finance',
  description: 'A live snapshot of your numbers, powered by Xero.',
  robots: { index: false },
};

export default async function PortalFinancePage() {
  const { orgs, activeOrg } = await getPortalContext();

  let finance: OrgFinance = { xeroConnected: false, snapshot: null, asOf: null };
  if (activeOrg) {
    const admin = createSupabaseAdminClient();
    finance = await getOrgFinance(admin, activeOrg.id);
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-12 lg:py-16">
      <Link
        href="/portal"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to portal
      </Link>

      <header className="mb-8">
        <PortalOrgLabel orgs={orgs} activeOrg={activeOrg} />
        <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-prose">
          A daily snapshot of your numbers, pulled from Xero. No spreadsheets, no waiting for month-end.
        </p>
      </header>

      <FinanceView finance={finance} />
    </main>
  );
}
