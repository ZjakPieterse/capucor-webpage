'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { OrgRecord } from '@/lib/portal/orgData';
import type { OrgDetailsInput } from '@/lib/validations';
import { updateOrgDetailsAction } from '@/app/internal/clients/[orgId]/actions';

// The Organisation card on the internal client view (read + edit in one place).
// Read mode shows the compliance master-data; an admin (canEdit) gets an "Edit
// details" affordance that swaps in the form. The Server Action it calls
// re-checks the admin role server-side, so this is purely the affordance. On a
// successful save it refreshes the route so the card re-reads the new values.

// OrgRecord → editable form shape (camelCase, '' for nulls).
function toForm(org: OrgRecord): OrgDetailsInput {
  return {
    displayName: org.display_name,
    legalName: org.legal_name ?? '',
    registrationNo: org.business_reg_no ?? '',
    address: org.address ?? '',
    incomeTaxNo: org.income_tax_no ?? '',
    vatNo: org.vat_no ?? '',
    payeNo: org.paye_no ?? '',
    uifNo: org.uif_no ?? '',
    coidaNo: org.coida_no ?? '',
    primaryContactName: org.primary_contact_name ?? '',
    primaryContactEmail: org.primary_contact_email,
  };
}

// Ordered read rows: [label, value]. Empty values render as a dash.
function readRows(org: OrgRecord): Array<[string, string]> {
  const dash = (v: string | null) => (v && v.trim() ? v : '—');
  return [
    ['Display name', org.display_name],
    ['Legal name', dash(org.legal_name)],
    ['Registration no.', dash(org.business_reg_no)],
    ['Income tax no.', dash(org.income_tax_no)],
    ['VAT no.', dash(org.vat_no)],
    ['PAYE no.', dash(org.paye_no)],
    ['UIF no.', dash(org.uif_no)],
    ['COIDA no.', dash(org.coida_no)],
    ['Primary contact name', dash(org.primary_contact_name)],
    ['Primary contact email', org.primary_contact_email],
    ['Address', dash(org.address)],
  ];
}

export function OrgDetailsEditor({ org, canEdit }: { org: OrgRecord; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<OrgDetailsInput>(() => toForm(org));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function open() {
    setForm(toForm(org));
    setError(null);
    setEditing(true);
  }

  function set<K extends keyof OrgDetailsInput>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateOrgDetailsAction(org.id, form);
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
      <>
        <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          {readRows(org).map(([label, value]) => (
            <div key={label}>
              <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
              </dt>
              <dd className="font-medium break-words">{value}</dd>
            </div>
          ))}
        </dl>
        {canEdit && (
          <div className="mt-5 border-t border-border/60 pt-4">
            <Button type="button" variant="outline" size="sm" onClick={open}>
              <Pencil className="h-3.5 w-3.5" />
              Edit details
            </Button>
          </div>
        )}
      </>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-5"
    >
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <EditField
          id="org-display-name"
          label="Display name"
          required
          value={form.displayName}
          onChange={(v) => set('displayName', v)}
          disabled={isPending}
          hint="Shown in the client portal and on proposals."
        />
        <EditField
          id="org-legal-name"
          label="Legal name"
          value={form.legalName ?? ''}
          onChange={(v) => set('legalName', v)}
          disabled={isPending}
        />
        <EditField
          id="org-reg-no"
          label="Registration no."
          value={form.registrationNo ?? ''}
          onChange={(v) => set('registrationNo', v)}
          disabled={isPending}
        />
        <EditField
          id="org-income-tax-no"
          label="Income tax no."
          value={form.incomeTaxNo ?? ''}
          onChange={(v) => set('incomeTaxNo', v)}
          disabled={isPending}
          hint="10 digits"
        />
        <EditField
          id="org-vat-no"
          label="VAT no."
          value={form.vatNo ?? ''}
          onChange={(v) => set('vatNo', v)}
          disabled={isPending}
          hint="10 digits"
        />
        <EditField
          id="org-paye-no"
          label="PAYE no."
          value={form.payeNo ?? ''}
          onChange={(v) => set('payeNo', v)}
          disabled={isPending}
          hint="10 digits"
        />
        <EditField
          id="org-uif-no"
          label="UIF no."
          value={form.uifNo ?? ''}
          onChange={(v) => set('uifNo', v)}
          disabled={isPending}
        />
        <EditField
          id="org-coida-no"
          label="COIDA no."
          value={form.coidaNo ?? ''}
          onChange={(v) => set('coidaNo', v)}
          disabled={isPending}
        />
        <EditField
          id="org-contact-name"
          label="Primary contact name"
          value={form.primaryContactName ?? ''}
          onChange={(v) => set('primaryContactName', v)}
          disabled={isPending}
        />
        <EditField
          id="org-contact-email"
          label="Primary contact email"
          type="email"
          required
          value={form.primaryContactEmail}
          onChange={(v) => set('primaryContactEmail', v)}
          disabled={isPending}
        />
        <EditField
          id="org-address"
          label="Address"
          value={form.address ?? ''}
          onChange={(v) => set('address', v)}
          disabled={isPending}
          className="sm:col-span-2"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
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
    </form>
  );
}

function EditField({
  id,
  label,
  value,
  onChange,
  disabled,
  required,
  type = 'text',
  hint,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  type?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
