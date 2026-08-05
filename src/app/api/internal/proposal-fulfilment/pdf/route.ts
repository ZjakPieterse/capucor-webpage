import { NextRequest, NextResponse } from 'next/server';
import { archiveSignedProposal } from '@/lib/portal/proposalPdf';
import { verifyReconciliationSignature } from '@/lib/portal/reconciliationAuth';
import { readJsonBody } from '@/lib/readJsonBody';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// One UUID. The HMAC gate below runs AFTER the body read (it signs the proposal
// id, so it needs it), which is exactly why this route needs its own cap rather
// than relying on the signature to keep large bodies out.
const MAX_BODY_BYTES = 4 * 1024;

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
  );
  if (!authorized) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized.' },
      { status: 401 },
    );
  }

  const result = await archiveSignedProposal(
    createSupabaseAdminClient(),
    proposalId,
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
