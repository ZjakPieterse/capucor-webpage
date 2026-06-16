import { ArrowUpRight, FolderOpen, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/config/site';

// Read-only documents content (shared Drive folder link, or a "not ready" state),
// shared by the client documents page and the internal view-only client mirror.
// Page chrome is supplied by the caller.
export function DocumentsView({ folderUrl }: { folderUrl: string | null }) {
  if (folderUrl) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 lg:p-8">
        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
          <FolderOpen className="h-5 w-5 text-primary" />
        </div>
        <h2 className="mb-2 text-lg font-semibold">Your shared Drive folder</h2>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
          Your monthly P&amp;L, balance sheet, VAT201 confirmations, IRP5s and supporting source
          documents live here. Drop receipts and bank statements into the same folder — your
          accountant picks them up at the next close.
        </p>
        <Button
          nativeButton={false}
          className="gap-2"
          render={<a href={folderUrl} target="_blank" rel="noopener noreferrer" />}
        >
          Open in Google Drive
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-dashed border-border bg-card p-6 text-center lg:p-8">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Lock className="h-5 w-5 text-muted-foreground" />
      </div>
      <h2 className="mb-2 text-lg font-semibold">Folder not ready yet</h2>
      <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-muted-foreground">
        We&apos;re setting up your dedicated Google Drive folder. Once your handover call is complete,
        your monthly reports and the upload spot for source documents will appear here.
      </p>
      <Button
        variant="outline"
        nativeButton={false}
        render={<a href={siteConfig.links.booking} target="_blank" rel="noopener noreferrer" />}
      >
        Book your handover call
      </Button>
    </section>
  );
}
