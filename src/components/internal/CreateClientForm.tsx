'use client';

import { useState, useTransition, type ComponentProps, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CLIENT_TYPES, CLIENT_TYPE_LABELS, type ClientType } from '@/config/clientTypes';
import type { CreateClientInput } from '@/lib/validations';
import { createClientAction } from '@/app/internal/clients/actions';

// Admin-only "Add client" form (/internal/clients/new). Mirrors the controlled-
// state + useTransition pattern of OrgDetailsEditor, and posts to the admin-gated
// createClientAction. The Billing block is optional: tick it to record a legacy/
// custom plan the pricing calculator can't express; leave it off for a client you
// only want to track (the client view then shows "No subscription on file yet.").

// Native <select> styled to match the Input primitive (avoids the base-ui
// Select.Value raw-value quirk for a small, fixed option set).
const SELECT_CLASS =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-input/30 px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

const SUB_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'past_due', label: 'Past due' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

type SubStatus = (typeof SUB_STATUSES)[number]['value'];
type OrgFields = Omit<CreateClientInput, 'subscription'>;

const EMPTY: OrgFields = {
  displayName: '',
  legalName: '',
  registrationNo: '',
  address: '',
  incomeTaxNo: '',
  vatNo: '',
  payeNo: '',
  uifNo: '',
  coidaNo: '',
  primaryContactName: '',
  primaryContactEmail: '',
  clientType: 'legacy',
  notes: '',
};

export function CreateClientForm() {
  const router = useRouter();
  const [form, setForm] = useState<OrgFields>(EMPTY);
  const [hasPlan, setHasPlan] = useState(false);
  const [plan, setPlan] = useState<{ planLabel: string; monthly: string; status: SubStatus }>({
    planLabel: '',
    monthly: '',
    status: 'active',
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof OrgFields>(key: K, value: OrgFields[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    setError(null);

    let subscription: CreateClientInput['subscription'];
    if (hasPlan) {
      const monthly = Number(plan.monthly);
      if (!plan.planLabel.trim()) {
        setError('Enter a plan label, or turn off "Record a current plan".');
        return;
      }
      if (!Number.isFinite(monthly) || monthly <= 0) {
        setError('Enter a valid monthly amount for the plan.');
        return;
      }
      subscription = { planLabel: plan.planLabel.trim(), monthlyZar: monthly, status: plan.status };
    }

    startTransition(async () => {
      const res = await createClientAction({ ...form, subscription });
      if (res.ok) {
        router.push(`/internal/clients/${res.orgId}`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-8"
    >
      <Section title="Organisation">
        <Field
          id="new-display-name"
          label="Display name"
          required
          value={form.displayName}
          onChange={(v) => set('displayName', v)}
          disabled={isPending}
          hint="The business name. Shown across the internal portal."
        />
        <Field
          id="new-legal-name"
          label="Legal name"
          value={form.legalName ?? ''}
          onChange={(v) => set('legalName', v)}
          disabled={isPending}
        />
        <Field
          id="new-contact-name"
          label="Primary contact name"
          value={form.primaryContactName ?? ''}
          onChange={(v) => set('primaryContactName', v)}
          disabled={isPending}
        />
        <Field
          id="new-contact-email"
          label="Primary contact email"
          type="email"
          required
          value={form.primaryContactEmail}
          onChange={(v) => set('primaryContactEmail', v)}
          disabled={isPending}
        />
        <Field
          id="new-reg-no"
          label="Registration no."
          value={form.registrationNo ?? ''}
          onChange={(v) => set('registrationNo', v)}
          disabled={isPending}
        />
        <Field
          id="new-address"
          label="Address"
          value={form.address ?? ''}
          onChange={(v) => set('address', v)}
          disabled={isPending}
          className="sm:col-span-2"
        />
      </Section>

      <Section title="Compliance (optional)">
        <Field
          id="new-income-tax"
          label="Income tax no."
          value={form.incomeTaxNo ?? ''}
          onChange={(v) => set('incomeTaxNo', v)}
          disabled={isPending}
          hint="10 digits"
        />
        <Field
          id="new-vat"
          label="VAT no."
          value={form.vatNo ?? ''}
          onChange={(v) => set('vatNo', v)}
          disabled={isPending}
          hint="10 digits"
        />
        <Field
          id="new-paye"
          label="PAYE no."
          value={form.payeNo ?? ''}
          onChange={(v) => set('payeNo', v)}
          disabled={isPending}
          hint="10 digits"
        />
        <Field
          id="new-uif"
          label="UIF no."
          value={form.uifNo ?? ''}
          onChange={(v) => set('uifNo', v)}
          disabled={isPending}
        />
        <Field
          id="new-coida"
          label="COIDA no."
          value={form.coidaNo ?? ''}
          onChange={(v) => set('coidaNo', v)}
          disabled={isPending}
        />
      </Section>

      <Section title="CRM">
        <div className="space-y-1.5">
          <Label htmlFor="new-client-type">Client type</Label>
          <select
            id="new-client-type"
            value={form.clientType}
            onChange={(e) => set('clientType', e.target.value as ClientType)}
            disabled={isPending}
            className={SELECT_CLASS}
          >
            {CLIENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {CLIENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="new-notes">Notes</Label>
          <Textarea
            id="new-notes"
            value={form.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
            disabled={isPending}
            rows={3}
            placeholder="Internal notes about this client…"
          />
          <p className="text-xs text-muted-foreground">Internal only. Never shown to the client.</p>
        </div>
      </Section>

      <div className="rounded-xl border border-border p-5">
        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input
            type="checkbox"
            checked={hasPlan}
            onChange={(e) => setHasPlan(e.target.checked)}
            disabled={isPending}
            className="h-4 w-4 rounded border-input"
          />
          Record a current plan for this client
        </label>
        <p className="mt-1.5 text-xs text-muted-foreground">
          For legacy or custom plans the pricing calculator can&apos;t express. Leave off for a
          client you only want to track.
        </p>
        {hasPlan && (
          <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Field
              id="new-plan-label"
              label="Plan label"
              required
              value={plan.planLabel}
              onChange={(v) => setPlan((p) => ({ ...p, planLabel: v }))}
              disabled={isPending}
              hint="e.g. 2023 retainer"
            />
            <Field
              id="new-plan-monthly"
              label="Monthly amount (ZAR)"
              required
              inputMode="decimal"
              value={plan.monthly}
              onChange={(v) => setPlan((p) => ({ ...p, monthly: v }))}
              disabled={isPending}
              hint="Before VAT. Tax is handled in Xero."
            />
            <div className="space-y-1.5">
              <Label htmlFor="new-plan-status">Status</Label>
              <select
                id="new-plan-status"
                value={plan.status}
                onChange={(e) => setPlan((p) => ({ ...p, status: e.target.value as SubStatus }))}
                disabled={isPending}
                className={SELECT_CLASS}
              >
                {SUB_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Creating…' : 'Create client'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push('/internal/clients')}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  disabled,
  required,
  type = 'text',
  inputMode,
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
  inputMode?: ComponentProps<'input'>['inputMode'];
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
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
