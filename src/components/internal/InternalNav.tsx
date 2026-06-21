'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SignOutButton } from '@/components/portal/SignOutButton';
import type { InternalUser } from '@/lib/auth/requireInternal';

// Shared top bar for the /internal staff hub. Client component so usePathname can
// drive the active-link state (PR13d). It takes the already-resolved internal
// user from the layout, so the only network island is SignOutButton.
const NAV_LINKS = [
  { href: '/internal/proposals', label: 'Proposals' },
  { href: '/internal/clients', label: 'Clients' },
];

export function InternalNav({ user }: { user: InternalUser }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-card/40">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
        <Link href="/internal/proposals" className="flex items-center gap-2 font-semibold">
          <Building2 className="h-4 w-4 text-primary" />
          Capucor internal
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'transition-colors',
                  active
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <Link
            href="/portal"
            className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Your portal</span>
          </Link>
          <span className="hidden text-muted-foreground sm:inline">
            {user.email} ({user.role})
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
