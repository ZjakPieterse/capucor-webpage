import type { Metadata } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getOrgFinance } from '@/lib/portal/orgData';
import { FinanceView } from '@/components/portal/FinanceView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Client finance' };

export default async function ClientFinancePage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const db = await createSupabaseServerClient();
  const finance = await getOrgFinance(db, orgId);

  return <FinanceView finance={finance} />;
}
