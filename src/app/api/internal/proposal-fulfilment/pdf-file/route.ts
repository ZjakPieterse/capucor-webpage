import { NextRequest, NextResponse } from 'next/server';
import { fetchSignedProposalPdf } from '@/lib/portal/proposalPdf';
import { verifyReconciliationSignature } from '@/lib/portal/reconciliationAuth';
import { readJsonBody } from '@/lib/readJsonBody';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// One UUID, as for the archive bridge beside this route.
const MAX_BODY_BYTES = 4 * 1024;

// The runner signs `timestamp.pdf-file.proposalId`, so an archive-bridge
// signature cannot read a PDF back.
const PDF_FILE_SIGNATURE_PURPOSE = 'pdf-file';

/**
 * The retry runner's read of an archived signed PDF, so a resent "That's
 * signed" email carries the same attachment as the Worker's first attempt. The
 * Apps Script secret stays in the Worker; the runner gets base64 or an error
 * code, never a Drive link.
 */
export async function POST(request: NextRequest) {
  const read = await readJsonBody(request, MAX_BODY_BYTES);
  if (!read.ok) {
    return NextResponse.json(
      { ok: false, error: 'Invalid request.' },
      { status: read.status },
    );
  }
  const body = (read.body ?? {}) as { proposalId?: unknown };
  const proposalId = typeof body.proposalId === 'string' ? body.proposalId : '';
  if (!UUID_PATTERN.test(proposalId)) {
    return NextResponse.json(
      { ok: false, error: 'Invalid request.' },
      { status: 400 },
    );
  }

  const authorized = await verifyReconciliationSignature(
    proposalId,
    request.headers.get('x-capucor-timestamp'),
    request.headers.get('x-capucor-signature'),
    Date.now(),
    PDF_FILE_SIGNATURE_PURPOSE,
  );
  if (!authorized) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized.' },
      { status: 401 },
    );
  }

  const { data, error } = await createSupabaseAdminClient()
    .from('proposals')
    .select('proposal_pdf_drive_id')
    .eq('id', proposalId)
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { ok: false, code: 'proposal_lookup_failed' },
      { status: 503 },
    );
  }
  if (!data?.proposal_pdf_drive_id) {
    return NextResponse.json(
      { ok: false, code: 'pdf_not_archived' },
      { status: 404 },
    );
  }

  const pdf = await fetchSignedProposalPdf(data.proposal_pdf_drive_id);
  return NextResponse.json(pdf, { status: pdf.ok ? 200 : 503 });
}
