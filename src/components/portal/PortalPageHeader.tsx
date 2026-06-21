import Link from 'next/link';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { PortalOrgLabel } from '@/components/portal/PortalOrgLabel';
import type { OrgSummary } from '@/lib/portal/activeOrg';

// Shared chrome for every portal sub-page: a back-to-hub link, the active-org
// label/switcher, and an icon-led title with an optional description. Keeps the
// sub-pages visually consistent with the hub's icon-led card headers.
export function PortalPageHeader({
  title,
  icon: Icon,
  orgs,
  activeOrg,
  description,
}: {
  title: string;
  icon: LucideIcon;
  orgs: OrgSummary[];
  activeOrg: OrgSummary | null;
  description?: string;
}) {
  return (
    <>
      <Link
        href="/portal"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to portal
      </Link>

      <header className="mb-8">
        <PortalOrgLabel orgs={orgs} activeOrg={activeOrg} />
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
            <Icon className="h-5 w-5 text-primary" />
          </span>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        </div>
        {description && (
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </header>
    </>
  );
}
