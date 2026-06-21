import type { Metadata } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getOrgRecord } from '@/lib/portal/orgData';
import { DocumentsView } from '@/components/portal/DocumentsView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Client documents' };

export default async function ClientDocumentsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const db = await createSupabaseServerClient();
  const org = await getOrgRecord(db, orgId);

  return <DocumentsView folderUrl={org?.drive_folder_url ?? null} surface="glass" />;
}
