'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// Sub-tabs for a single client's view-only mirror. usePathname drives the active
// state (the PR13b discovery applied at the client-view level).
export function ClientViewTabs({ orgId }: { orgId: string }) {
  const pathname = usePathname();
  const base = `/internal/clients/${orgId}`;

  const tabs = [
    { href: base, label: 'Overview' },
    { href: `${base}/documents`, label: 'Documents' },
    { href: `${base}/billing`, label: 'Billing' },
    { href: `${base}/finance`, label: 'Finance' },
    { href: `${base}/proposals`, label: 'Proposals' },
  ];

  return (
    <nav className="flex flex-wrap gap-1 border-b border-border">
      {tabs.map((t) => {
        const active =
          t.href === base
            ? pathname === base
            : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
              active
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
