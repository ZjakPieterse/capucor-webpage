import type { Metadata } from 'next';
import Link from 'next/link';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { timingSafeEqual } from '@/lib/security';
import { formatZAR } from '@/lib/utils';

// Internal, secret-gated proposal tracker. Read-only by design: amend / resend
// run through /api/proposals/{amend,resend} (also secret-guarded) so the secret
// never ships into client JS. Replace the ?secret= gate with real staff auth
// when that surface exists.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Proposals',
  robots: { index: false, follow: false },
};

interface ListRow {
  token: string;
  ref_number: string | null;
  version: number;
  business_name: string;
  first_name: string;
  last_name: string;
  email: string;
  tier_slug: string;
  monthly_total_zar: number;
  status: string;
  sent_at: string | null;
  signed_at: string | null;
}

const dateZA = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

function authorised(secret: string | undefined): boolean {
  return (
    !!process.env.REVALIDATE_SECRET &&
    !!secret &&
    timingSafeEqual(secret, process.env.REVALIDATE_SECRET)
  );
}

export default async function InternalProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ secret?: string }>;
}) {
  const { secret } = await searchParams;
  if (!authorised(secret)) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Not authorised</h1>
        <p className="mt-3 text-sm text-muted-foreground">Add the access secret to view this page.</p>
      </div>
    );
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('proposals')
    .select(
      'token, ref_number, version, business_name, first_name, last_name, email, tier_slug, monthly_total_zar, status, sent_at, signed_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  const rows = (data ?? []) as unknown as ListRow[];

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proposals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} most recent · amend &amp; resend via the secret-guarded API.
          </p>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          Could not load proposals.
        </p>
      )}

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
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.token} className="border-t border-border/60">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                  {r.ref_number ?? '—'}
                  {r.version > 1 && (
                    <span className="ml-1 text-muted-foreground">r{r.version}</span>
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
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs capitalize">
                    {r.status}
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
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  No proposals yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
