import { NextRequest, NextResponse } from 'next/server';
import { archiveSignedProposal } from '@/lib/portal/proposalPdf';
import { verifyReconciliationSignature } from '@/lib/portal/reconciliationAuth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  let proposalId = '';
  try {
    const body = (await request.json()) as { proposalId?: unknown };
    proposalId = typeof body.proposalId === 'string' ? body.proposalId : '';
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid request.' },
      { status: 400 },
    );
  }
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
