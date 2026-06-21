import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { PORTAL_CARD } from '@/components/portal/portalCard';

// Row of glassy quick-action tiles, shared by the client portal hub and the
// internal view-only client mirror. Each action is an icon-led link; the page
// supplies the targets (the portal links to /portal/*, the mirror to
// /internal/clients/[orgId]/*), so the component stays purely presentational.

export interface PortalQuickAction {
  label: string;
  icon: LucideIcon;
  href: string;
  external?: boolean;
}

export function PortalQuickActions({
  actions,
  className,
}: {
  actions: PortalQuickAction[];
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-2 gap-3 sm:grid-cols-4 ${className ?? ''}`}>
      {actions.map((action) => {
        const Icon = action.icon;
        const inner = (
          <>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
              <Icon className="h-4 w-4 text-primary" />
            </span>
            <span className="flex items-center gap-1 text-sm font-medium">
              {action.label}
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          </>
        );
        const cls = `${PORTAL_CARD} flex flex-col items-start gap-3 p-4`;
        return action.external ? (
          <a
            key={action.label}
            href={action.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cls}
          >
            {inner}
          </a>
        ) : (
          <Link key={action.label} href={action.href} className={cls}>
            {inner}
          </Link>
        );
      })}
    </div>
  );
}
