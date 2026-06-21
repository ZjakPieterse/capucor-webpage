import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getPortalContext } from '@/lib/portal/portalContext';
import { getOrgRecord } from '@/lib/portal/orgData';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { DocumentsView } from '@/components/portal/DocumentsView';

export const metadata: Metadata = {
  title: 'Documents',
  description: 'Your Capucor shared document folder.',
  robots: { index: false },
};

export default async function PortalDocumentsPage() {
  const { orgs, activeOrg } = await getPortalContext();

  if (!activeOrg) {
    return <DocumentsNotReadyState />;
  }

  const admin = createSupabaseAdminClient();
  const org = await getOrgRecord(admin, activeOrg.id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
      <PortalPageHeader title="Documents" icon={FileText} orgs={orgs} activeOrg={activeOrg} />
      <DocumentsView folderUrl={org?.drive_folder_url ?? null} surface="glass" />
    </main>
  );
}

function DocumentsNotReadyState() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16 lg:py-24 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 mb-5">
        <Lock className="h-5 w-5 text-primary" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-3">
        Your subscription is being set up
      </h1>
      <p className="text-sm text-muted-foreground leading-relaxed mb-8">
        Documents will appear here once your account is provisioned.
      </p>
      <Button nativeButton={false} render={<Link href="/portal" />}>
        Back to portal
      </Button>
    </main>
  );
}
