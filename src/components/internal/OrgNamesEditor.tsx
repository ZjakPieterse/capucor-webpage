'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateOrgNamesAction } from '@/app/internal/clients/[orgId]/actions';

// Admin-only inline editor for a client org's Display name + Legal name. Mounted
// only for admins by the internal client page; the Server Action it calls
// re-checks the admin role server-side, so this is purely the affordance. On a
// successful save it refreshes the route so the Organisation card re-reads the
// new values.
export function OrgNamesEditor({
  orgId,
  displayName,
  legalName,
}: {
  orgId: string;
  displayName: string;
  legalName: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [display, setDisplay] = useState(displayName);
  const [legal, setLegal] = useState(legalName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function open() {
    setDisplay(displayName);
    setLegal(legalName ?? '');
    setError(null);
    setEditing(true);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateOrgNamesAction(orgId, display, legal);
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (!editing) {
    return (
      <div className="mt-5 border-t border-border/60 pt-4">
        <Button type="button" variant="outline" size="sm" onClick={open}>
          <Pencil className="h-3.5 w-3.5" />
          Edit names
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4 border-t border-border/60 pt-4">
      <div className="space-y-1.5">
        <Label htmlFor="org-display-name">Display name</Label>
        <Input
          id="org-display-name"
          value={display}
          onChange={(e) => setDisplay(e.target.value)}
          disabled={isPending}
          aria-invalid={Boolean(error)}
        />
        <p className="text-xs text-muted-foreground">
          Shown in the client portal and on proposals.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="org-legal-name">Legal name</Label>
        <Input
          id="org-legal-name"
          value={legal}
          onChange={(e) => setLegal(e.target.value)}
          disabled={isPending}
          placeholder="Registered name (optional)"
        />
        <p className="text-xs text-muted-foreground">
          Regulatory record only. Leave blank if not known.
        </p>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={save} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
