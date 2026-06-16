import type { Metadata } from 'next';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireInternal } from '@/lib/auth/requireInternal';
import { ProposalsTable, type ProposalRow } from '@/components/internal/ProposalsTable';

// Internal proposal tracker (PR13b). Auth and the shared hub chrome live in
// src/app/internal/layout.tsx; this page only fetches + renders. The list is
// read via the admin client — the layout already verified the internal session,
// so the gate is real; switching internal pages to session-bound RLS reads is
// bundled with PR13d (view-only client-portal data). Amend / resend are surfaced
// for admins here but wired in PR13c.
export const dynamic = 'force-dynamic';

const PATH = '/internal/proposals';

export const metadata: Metadata = {
  title: 'Proposals',
};

export default async function InternalProposalsPage() {
  // The layout already gated access; this resolves the role for action gating.
  // Returns null only if somehow reached unauthorised — the layout renders the
  // "not authorised" UI in that case, so we render nothing (and skip the read).
  const internal = await requireInternal(PATH);
  if (!internal) return null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('proposals')
    .select(
      'id, token, ref_number, version, supersedes_id, superseded_by_id, business_name, first_name, last_name, email, tier_slug, monthly_total_zar, status, sent_at, signed_at, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  const rows = (data ?? []) as unknown as ProposalRow[];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Proposals</h1>
        <p className="mt-1 text-sm text-muted-foreground">{rows.length} most recent.</p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          Could not load proposals.
        </p>
      )}

      <ProposalsTable rows={rows} canManage={internal.role === 'admin'} />
    </div>
  );
}
