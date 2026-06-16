import type { Metadata } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getOrgProposals, getOrgRecord } from '@/lib/portal/orgData';
import { normaliseOrgEmails } from '@/lib/internal/clientProposals';
import { ProposalsTable } from '@/components/internal/ProposalsTable';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Client proposals' };

export default async function ClientProposalsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const db = await createSupabaseServerClient();

  const org = await getOrgRecord(db, orgId);
  // proposals have no client_org_id FK (PR9 provisioning) — match by the org's
  // contact email. Read via the session client (RLS internal_select_proposals).
  const emails = normaliseOrgEmails([org?.primary_contact_email]);
  const rows = await getOrgProposals(db, emails);

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Proposals matched to{' '}
        <span className="font-medium text-foreground">{org?.primary_contact_email ?? '—'}</span>.
        View-only.
      </p>
      {/* canManage=false — amend/resend stay on the proposals hub for admins. */}
      <ProposalsTable rows={rows} canManage={false} />
    </div>
  );
}
