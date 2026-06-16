'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn, formatZAR } from '@/lib/utils';
import { isReviewDue } from '@/lib/internal/proposalReview';

// Mirrors the resend route's RESENDABLE guard — a fresh link only makes sense
// while the proposal is still open or has lapsed. Other statuses (signed/etc.)
// are amended instead.
const RESENDABLE = new Set(['sent', 'viewed', 'expired']);

export interface ProposalRow {
  id: string;
  token: string;
  ref_number: string | null;
  version: number;
  supersedes_id: string | null;
  superseded_by_id: string | null;
  business_name: string;
  first_name: string;
  last_name: string;
  email: string;
  tier_slug: string;
  monthly_total_zar: number;
  status: string;
  sent_at: string | null;
  signed_at: string | null;
  created_at: string;
}

// Mirrors the proposals status CHECK (migrations 006 + 010).
const STATUS_OPTIONS = [
  'sent',
  'viewed',
  'signed',
  'paid',
  'active',
  'expired',
  'declined',
  'superseded',
] as const;

type SortKey = 'newest' | 'oldest' | 'monthly' | 'business';

const dateZA = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: '2-digit' })
    : '—';

export function ProposalsTable({
  rows,
  canManage,
}: {
  rows: ProposalRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [reviewOnly, setReviewOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('newest');
  // Per-row resend feedback: the id being sent, and a one-line result message.
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  async function handleResend(row: ProposalRow) {
    if (resendingId) return;
    if (!window.confirm(`Re-send this proposal to ${row.email}?`)) return;
    setResendingId(row.id);
    setResendMsg(null);
    try {
      const res = await fetch('/api/proposals/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: row.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not re-send the proposal.');
      setResendMsg({ id: row.id, text: 'Sent', ok: true });
      router.refresh();
    } catch (err) {
      setResendMsg({
        id: row.id,
        text: err instanceof Error ? err.message : 'Could not re-send.',
        ok: false,
      });
    } finally {
      setResendingId(null);
    }
  }

  // id → row, so revision lineage can resolve a ref + token to link to. Only
  // covers rows in the current window; an ancestor outside it shows unlinked.
  const byId = useMemo(() => {
    const map = new Map<string, ProposalRow>();
    for (const r of rows) map.set(r.id, r);
    return map;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (reviewOnly && !isReviewDue(r.status, r.signed_at)) return false;
      if (q) {
        const haystack =
          `${r.business_name} ${r.first_name} ${r.last_name} ${r.email} ${r.ref_number ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return [...result].sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return a.created_at.localeCompare(b.created_at);
        case 'monthly':
          return Number(b.monthly_total_zar) - Number(a.monthly_total_zar);
        case 'business':
          return a.business_name.localeCompare(b.business_name);
        case 'newest':
        default:
          return b.created_at.localeCompare(a.created_at);
      }
    });
  }, [rows, search, status, reviewOnly, sort]);

  const colSpan = canManage ? 10 : 9;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search business, contact, email, reference…"
          aria-label="Search proposals"
          className="w-full sm:w-72"
        />

        <Select value={status} onValueChange={(v) => setStatus(String(v))}>
          <SelectTrigger aria-label="Filter by status" className="min-w-[8.5rem]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger aria-label="Sort proposals" className="min-w-[8.5rem]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="monthly">Highest monthly</SelectItem>
            <SelectItem value="business">Business A–Z</SelectItem>
          </SelectContent>
        </Select>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={reviewOnly}
            onCheckedChange={(checked) => setReviewOnly(checked === true)}
          />
          Review due only
        </label>

        <span className="ml-auto text-sm text-muted-foreground">
          {filtered.length} of {rows.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-card/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Reference</th>
              <th className="px-3 py-2 font-medium">Business</th>
              <th className="px-3 py-2 font-medium">Contact</th>
              <th className="px-3 py-2 font-medium">Tier</th>
              <th className="px-3 py-2 text-right font-medium">Monthly</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Sent</th>
              <th className="px-3 py-2 font-medium">Signed</th>
              <th className="px-3 py-2 font-medium">Open</th>
              {canManage && <th className="px-3 py-2 font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const superseded = r.status === 'superseded';
              const newer = r.superseded_by_id ? byId.get(r.superseded_by_id) : null;
              const older = r.supersedes_id ? byId.get(r.supersedes_id) : null;
              const reviewDue = isReviewDue(r.status, r.signed_at);
              return (
                <tr
                  key={r.token}
                  className={`border-t border-border/60 [&>td]:align-top ${superseded ? 'text-muted-foreground' : ''}`}
                >
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                    <span>{r.ref_number ?? '—'}</span>
                    {r.version > 1 && <span className="ml-1 text-muted-foreground">r{r.version}</span>}
                    {(newer || older) && (
                      <span className="mt-0.5 block font-sans text-[11px] leading-tight text-muted-foreground">
                        {newer && (
                          <span className="block">
                            Superseded by{' '}
                            <Link
                              href={`/proposal/${newer.token}`}
                              target="_blank"
                              className="underline underline-offset-2"
                            >
                              {newer.ref_number ?? '—'}
                            </Link>
                          </span>
                        )}
                        {older && (
                          <span className="block">
                            Replaces{' '}
                            <Link
                              href={`/proposal/${older.token}`}
                              target="_blank"
                              className="underline underline-offset-2"
                            >
                              {older.ref_number ?? '—'}
                            </Link>
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{r.business_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.first_name} {r.last_name}
                    <span className="block text-xs">{r.email}</span>
                  </td>
                  <td className="px-3 py-2 capitalize">{r.tier_slug}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono">
                    {formatZAR(Number(r.monthly_total_zar))}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex flex-wrap items-center gap-1">
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs capitalize">
                        {r.status}
                      </span>
                      {reviewDue && (
                        <span className="rounded-full border border-warning/30 bg-warning/15 px-2 py-0.5 text-xs text-warning">
                          Review due
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{dateZA(r.sent_at)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{dateZA(r.signed_at)}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/proposal/${r.token}`}
                      className="text-primary underline underline-offset-2"
                      target="_blank"
                    >
                      View
                    </Link>
                  </td>
                  {canManage && (
                    <td className="whitespace-nowrap px-3 py-2">
                      <div className="flex items-center gap-2">
                        {/* Amend opens the calculator seeded from this proposal;
                            submit issues a new revision (supersedes this one). */}
                        {superseded ? (
                          <Button variant="outline" size="sm" disabled title="Already superseded">
                            Amend
                          </Button>
                        ) : (
                          <Link
                            href={`/internal/proposals/${r.id}/amend`}
                            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                          >
                            Amend
                          </Link>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!RESENDABLE.has(r.status) || resendingId === r.id}
                          title={
                            RESENDABLE.has(r.status)
                              ? 'Send a fresh link to the client'
                              : 'Only open or expired proposals can be re-sent'
                          }
                          onClick={() => handleResend(r)}
                        >
                          {resendingId === r.id ? 'Sending…' : 'Resend'}
                        </Button>
                        {resendMsg?.id === r.id && (
                          <span
                            className={`text-xs ${resendMsg.ok ? 'text-primary' : 'text-destructive'}`}
                          >
                            {resendMsg.text}
                          </span>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-3 py-8 text-center text-muted-foreground">
                  {rows.length === 0 ? 'No proposals yet.' : 'No proposals match your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
