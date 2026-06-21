import type { Metadata } from 'next';
import Link from 'next/link';
import { requireInternal } from '@/lib/auth/requireInternal';
import { InternalNav } from '@/components/internal/InternalNav';
import { SignOutButton } from '@/components/portal/SignOutButton';

// The /internal staff hub (PR13b). One gate (requireInternal → the
// public.internal_users allowlist, migration 011) + the shared nav live here, so
// every /internal page inherits them. Since PR11 stripped the marketing chrome
// out of the root layout, /internal stands alone with just this gate + InternalNav.
// The hub is utilitarian by design: it opts out of the public premium-section /
// SectionDivider rhythm.
export const dynamic = 'force-dynamic';

// Default landing for the hub and the post-login `next` target. Once more
// /internal pages exist (PR13d) a per-page `next` becomes worthwhile.
const HUB_PATH = '/internal/proposals';

export const metadata: Metadata = {
  title: { default: 'Internal', template: '%s | Capucor internal' },
  robots: { index: false, follow: false },
};

export default async function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Redirects to /login when signed out; returns null when signed in but not on
  // the internal allowlist.
  const internal = await requireInternal(HUB_PATH);

  if (!internal) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Not authorised</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This area is for Capucor staff. If you think you should have access, ask an
          administrator to add your email.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Link href="/portal" className="text-sm text-primary underline underline-offset-2">
            Go to your portal
          </Link>
          <SignOutButton />
        </div>
      </div>
    );
  }

  return (
    <>
      <InternalNav user={internal} />
      {children}
    </>
  );
}
