import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { SignOutButton } from '@/components/portal/SignOutButton';
import type { InternalUser } from '@/lib/auth/requireInternal';

// Shared top bar for the /internal staff hub. Server component — it takes the
// already-resolved internal user from the layout, so the only client island is
// SignOutButton. Proposals is the single link today; Leads / Clients (and a
// usePathname-driven active state) land with PR13d.
const NAV_LINKS = [{ href: '/internal/proposals', label: 'Proposals' }];

export function InternalNav({ user }: { user: InternalUser }) {
  return (
    <header className="border-b border-border bg-card/40">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
        <Link href="/internal/proposals" className="flex items-center gap-2 font-semibold">
          <Building2 className="h-4 w-4 text-primary" />
          Capucor internal
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden text-muted-foreground sm:inline">
            {user.email} ({user.role})
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
