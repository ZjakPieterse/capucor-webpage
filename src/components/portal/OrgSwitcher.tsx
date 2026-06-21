'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { setActiveOrgAction } from '@/app/portal/actions';
import type { OrgSummary } from '@/lib/portal/activeOrg';

// Active-business switcher for multi-org clients. Renders nothing for a
// single-org user, so it is safe to drop into every portal header. On change it
// writes the active-org cookie via the Server Action, then refreshes so the
// page's server data re-reads against the new org.
export function OrgSwitcher({
  orgs,
  activeId,
}: {
  orgs: OrgSummary[];
  activeId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (orgs.length <= 1) return null;

  function handleChange(value: string | null) {
    if (!value || value === activeId) return;
    startTransition(async () => {
      await setActiveOrgAction(value);
      router.refresh();
    });
  }

  return (
    <div className="mb-2 flex items-center gap-2">
      <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <Select value={activeId} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger aria-label="Switch business" className="min-w-[12rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {orgs.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.display_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
