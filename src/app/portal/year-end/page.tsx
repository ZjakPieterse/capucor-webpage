import type { Metadata } from 'next';
import { ClipboardList, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPortalContext } from '@/lib/portal/portalContext';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { siteConfig } from '@/config/site';
import { YearEndChecklist } from '@/components/portal/YearEndChecklist';

export const metadata: Metadata = {
  title: 'Year-end planner',
  description: 'A prep checklist for your annual financial statements and year-end.',
  robots: { index: false },
};

export default async function PortalYearEndPage() {
  const { orgs, activeOrg } = await getPortalContext();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
      <PortalPageHeader
        title="Year-end planner"
        icon={ClipboardList}
        orgs={orgs}
        activeOrg={activeOrg}
        description="Everything we need to close your year and prepare your annual financial statements. Tick items off as you gather them — the faster this is complete, the sooner your AFS and tax return are done."
      />

      <YearEndChecklist />

      <div className="premium-glass mt-8 rounded-xl border border-dashed border-white/15 bg-card/40 p-5">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
          <Info className="h-4 w-4 text-primary" />
          Not sure about something?
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          You don&rsquo;t need every item before we start — get going with what you have and we&rsquo;ll chase the rest together. If anything on the list is unclear for your business, ask.
        </p>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={
            <a href={siteConfig.links.booking} target="_blank" rel="noopener noreferrer" />
          }
        >
          Book a year-end call
        </Button>
      </div>
    </main>
  );
}
