'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export interface ClientRow {
  id: string;
  name: string;
  primary_contact_email: string;
  status: string; // org status: active / paused / cancelled
  tierSlug: string | null;
  subStatus: string | null; // latest subscription status, if any
  created_at: string;
}

// Mirrors the client_orgs status CHECK (migration 004).
const STATUS_OPTIONS = ['active', 'paused', 'cancelled'] as const;

type SortKey = 'name' | 'newest';

export function ClientsTable({ rows }: { rows: ClientRow[] }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('name');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (q) {
        const haystack = `${r.name} ${r.primary_contact_email}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return [...result].sort((a, b) => {
      switch (sort) {
        case 'newest':
          return b.created_at.localeCompare(a.created_at);
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [rows, search, status, sort]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search business or contact email…"
          aria-label="Search clients"
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
          <SelectTrigger aria-label="Sort clients" className="min-w-[8.5rem]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Business A–Z</SelectItem>
            <SelectItem value="newest">Newest first</SelectItem>
          </SelectContent>
        </Select>

        <span className="ml-auto text-sm text-muted-foreground">
          {filtered.length} of {rows.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-card/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Business</th>
              <th className="px-3 py-2 font-medium">Contact</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Tier</th>
              <th className="px-3 py-2 font-medium">Subscription</th>
              <th className="px-3 py-2 font-medium">View</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-border/60 [&>td]:align-top">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.primary_contact_email}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs capitalize">
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2 capitalize">{r.tierSlug ?? '—'}</td>
                <td className="px-3 py-2 capitalize text-muted-foreground">
                  {r.subStatus ? r.subStatus.replace(/_/g, ' ') : 'None'}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/internal/clients/${r.id}`}
                    className="text-primary underline underline-offset-2"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  {rows.length === 0 ? 'No clients yet.' : 'No clients match your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
