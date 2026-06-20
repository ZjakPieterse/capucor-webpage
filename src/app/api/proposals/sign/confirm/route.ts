/**
 * POST /api/proposals/sign/confirm  —  Step B of email-bound signing
 *
 * The recipient clicked the one-time "Confirm & sign" link from their own inbox
 * (Step A emailed it to the proposal address) and pressed Confirm. Only now do
 * we commit: promote the pending signature into the real columns, flip status to
 * `signed`, provision the portal, archive the PDF, and email client + owner.
 *
 * Finalising on a POST (a button press), not the bare GET of the confirm page,
 * means an email link-scanner that prefetches the URL can't auto-sign.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/getClientIp';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { finalizeProposalSignature, type FinalizeSignRow } from '@/lib/portal/finalizeSign';

const PENDING_COLUMNS =
  'id, token, ref_number, first_name, last_name, business_name, email, status, expires_at, ' +
  'services, brackets, tier_slug, addons, monthly_total_zar, vat_zar, total_charge_zar, ' +
  'client_org_id, sign_confirm_expires_at, pending_signature_name, pending_signature_method, ' +
  'pending_signature_image, pending_signature_ip';

interface ConfirmRow extends FinalizeSignRow {
  expires_at: string | null;
  sign_confirm_expires_at: string | null;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);

  const { allowed, retryAfter } = await checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again in a few minutes.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const ctoken =
    body && typeof body === 'object' && 'ctoken' in body
      ? String((body as Record<string, unknown>).ctoken ?? '')
      : '';
  if (ctoken.length < 16) {
    return NextResponse.json({ error: 'This confirmation link is invalid.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // Look up the pending proposal by its confirm token.
  let row: ConfirmRow;
  try {
    const { data, error } = await admin
      .from('proposals')
      .select(PENDING_COLUMNS)
      .eq('sign_confirm_token', ctoken)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      // Already used (cleared on commit), never issued, or wrong token.
      return NextResponse.json(
        { error: 'This confirmation link is no longer valid. It may already have been used.' },
        { status: 404 },
      );
    }
    row = data as unknown as ConfirmRow;
  } catch (err) {
    console.error('[SIGN/CONFIRM] lookup error:', err);
    return NextResponse.json(
      { error: 'Could not load this confirmation. Please try again.' },
      { status: 500 },
    );
  }

  // Confirm-token expiry (separate from the proposal's own 7-day expiry).
  if (
    row.sign_confirm_expires_at &&
    new Date(row.sign_confirm_expires_at).getTime() < Date.now()
  ) {
    return NextResponse.json(
      { error: 'This confirmation link has expired. Please sign again to get a fresh one.' },
      { status: 410 },
    );
  }
  if (row.status === 'signed' || row.status === 'paid' || row.status === 'active') {
    return NextResponse.json(
      { error: 'This proposal has already been signed.' },
      { status: 409 },
    );
  }

  const result = await finalizeProposalSignature(admin, row);

  if (!result.ok) {
    if (result.outcome === 'already') {
      return NextResponse.json(
        { error: 'This proposal has already been signed.' },
        { status: 409 },
      );
    }
    if (result.outcome === 'invalid') {
      return NextResponse.json(
        { error: 'There is no pending signature to confirm. Please sign again.' },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'Could not finalise your signature. Please try again.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, provisioned: result.provisioned ?? false });
}
