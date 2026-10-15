import type { Metadata } from 'next';
import { requireInternalPage } from '@/lib/internal/guard';

// Staff-only area, served on internal.capucor.com (next.config.ts rewrites that
// host onto /internal-tools). Never indexed; never in the sitemap. Each page
// also calls requireInternalPage() itself — a layout is not re-run on every
// client navigation, so it is not the gate on its own.
export const metadata: Metadata = {
  title: { default: 'Internal', template: '%s | Capucor internal' },
  robots: { index: false, follow: false },
};

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireInternalPage();
  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4 text-sm">
          <span className="font-semibold">Capucor internal</span>
          {email ? <span className="text-muted-foreground">{email}</span> : null}
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
