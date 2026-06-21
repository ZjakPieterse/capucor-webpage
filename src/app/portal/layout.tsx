import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Building2 } from 'lucide-react';
import { SignOutButton } from '@/components/portal/SignOutButton';
import { getInternalUser } from '@/lib/auth/getInternalUser';

// Minimal app shell for the client portal — a slim top bar instead of the
// marketing Navbar/Footer. No auth logic here: every /portal page resolves the
// session via getPortalContext()/requireSession(), which redirects a signed-out
// visitor to /login before this chrome renders. portal/loading.tsx is the
// Suspense fallback for the children below.
//
// Async only to surface a "Staff area" link for visitors who are also on the
// internal allowlist. getInternalUser() is non-redirecting, so it leaves the
// signed-out redirect (handled per-page) untouched and returns null for plain
// client users, who then see no internal link.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const internal = await getInternalUser();

  return (
    <>
      <header className="border-b border-border bg-card/40">
        <div className="mx-auto flex max-w-5xl items-center gap-x-4 gap-y-2 px-6 py-3">
          <Link href="/portal" className="flex items-center transition-opacity hover:opacity-80">
            <Image
              src="/brand/logo-dark.png"
              alt="Capucor Business Solutions"
              height={40}
              width={200}
              className="h-8 w-auto"
              style={{ width: 'auto' }}
            />
          </Link>
          <div className="ml-auto flex items-center gap-4 text-sm">
            {internal && (
              <Link
                href="/internal"
                className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline">Staff area</span>
              </Link>
            )}
            <Link
              href="/"
              className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to website</span>
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </>
  );
}
