import type { Metadata } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getOrgInvoices, getOrgSubscription } from '@/lib/portal/orgData';
import { BillingView } from '@/components/portal/BillingView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Client billing' };

export default async function ClientBillingPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const db = await createSupabaseServerClient();

  const sub = await getOrgSubscription(db, orgId);
  const invoices = sub ? await getOrgInvoices(db, orgId) : [];

  return <BillingView sub={sub} invoices={invoices} />;
}
