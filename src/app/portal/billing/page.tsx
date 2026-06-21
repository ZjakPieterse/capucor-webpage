import type { Metadata } from 'next';
import Link from 'next/link';
import { Lock, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getPortalContext } from '@/lib/portal/portalContext';
import { getOrgInvoices, getOrgSubscription } from '@/lib/portal/orgData';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { BillingView } from '@/components/portal/BillingView';

export const metadata: Metadata = {
  title: 'Billing',
  description: 'Your Capucor subscription and invoice history.',
  robots: { index: false },
};

export default async function PortalBillingPage() {
  const { orgs, activeOrg } = await getPortalContext();

  if (!activeOrg) {
    return <BillingNotReadyState />;
  }

  const admin = createSupabaseAdminClient();
  const sub = await getOrgSubscription(admin, activeOrg.id);

  if (!sub) {
    return <BillingNotReadyState />;
  }

  const invoices = await getOrgInvoices(admin, activeOrg.id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
      <PortalPageHeader title="Billing" icon={Receipt} orgs={orgs} activeOrg={activeOrg} />
      <BillingView sub={sub} invoices={invoices} surface="glass" />
    </main>
  );
}

function BillingNotReadyState() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16 lg:py-24 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 mb-5">
        <Lock className="h-5 w-5 text-primary" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-3">
        Your subscription is being set up
      </h1>
      <p className="text-sm text-muted-foreground leading-relaxed mb-8">
        Billing details and invoices will appear here once your account is provisioned.
      </p>
      <Button nativeButton={false} render={<Link href="/portal" />}>
        Back to portal
      </Button>
    </main>
  );
}
