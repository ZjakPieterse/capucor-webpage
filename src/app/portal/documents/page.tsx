import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, FolderOpen, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { requireSession } from '@/lib/auth/requireSession';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Documents',
  description: 'Your Capucor shared document folder.',
  robots: { index: false },
};

export default async function PortalDocumentsPage() {
  const user = await requireSession();
  const supabase = createSupabaseAdminClient();

  const { data: membership } = await supabase
    .from('client_org_members')
    .select('client_org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return <DocumentsNotReadyState />;
  }

  const { data: org } = await supabase
    .from('client_orgs')
    .select('name, drive_folder_url')
    .eq('id', membership.client_org_id)
    .maybeSingle();

  if (!org) {
    return <DocumentsNotReadyState />;
  }

  const folderUrl = (org.drive_folder_url as string | null) ?? null;
  const orgName = org.name as string;

  return (
    <main className="max-w-3xl mx-auto px-6 py-12 lg:py-16">
      <Link
        href="/portal"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to portal
      </Link>

      <header className="mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          {orgName}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
      </header>

      {folderUrl ? (
        <section className="rounded-xl border border-border bg-card p-6 lg:p-8">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 mb-4">
            <FolderOpen className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Your shared Drive folder</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Your monthly P&amp;L, balance sheet, VAT201 confirmations, IRP5s and supporting source documents live here. Drop receipts and bank statements into the same folder — your accountant picks them up at the next close.
          </p>
          <Button
            nativeButton={false}
            className="gap-2"
            render={
              <a
                href={folderUrl}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            Open in Google Drive
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-border bg-card p-6 lg:p-8 text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-4">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Folder not ready yet</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-md mx-auto">
            We&apos;re setting up your dedicated Google Drive folder. Once your handover call is complete, your monthly reports and the upload spot for source documents will appear here.
          </p>
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <a
                href={siteConfig.links.booking}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            Book your handover call
          </Button>
        </section>
      )}
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
