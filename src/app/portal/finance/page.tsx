import type { Metadata } from 'next';
import { LineChart } from 'lucide-react';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getPortalContext } from '@/lib/portal/portalContext';
import { getOrgFinance, type OrgFinance } from '@/lib/portal/orgData';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
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
    <main className="mx-auto max-w-4xl px-6 py-12 lg:py-16">
      <PortalPageHeader
        title="Finance"
        icon={LineChart}
        orgs={orgs}
        activeOrg={activeOrg}
        description="A daily snapshot of your numbers, pulled from Xero. No spreadsheets, no waiting for month-end."
      />
      <FinanceView finance={finance} surface="glass" />
    </main>
  );
}
