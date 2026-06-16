import { OrgSwitcher } from '@/components/portal/OrgSwitcher';
import type { OrgSummary } from '@/lib/portal/activeOrg';

// Header element for every portal page: the active-business switcher when the
// user has more than one org, otherwise the plain org-name label the pages
// showed before. Drop it in above each page's <h1>.
export function PortalOrgLabel({
  orgs,
  activeOrg,
}: {
  orgs: OrgSummary[];
  activeOrg: OrgSummary | null;
}) {
  if (!activeOrg) return null;

  if (orgs.length > 1) {
    return <OrgSwitcher orgs={orgs} activeId={activeOrg.id} />;
  }

  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
      {activeOrg.name}
    </p>
  );
}
