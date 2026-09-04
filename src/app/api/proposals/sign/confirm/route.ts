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
import { readJsonBody } from '@/lib/readJsonBody';
import { getClientIp } from '@/lib/getClientIp';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { addonSlugsFromStored, bracketMapFromStored } from '@/lib/portal/proposalJson';
import type { Json } from '@/types/db';
import {
  finalizeProposalSignature,
  type FinalizeSignRow,
} from '@/lib/portal/finalizeSign';

// ⚠️ ONE STRING LITERAL, DELIBERATELY. Keep it that way.
//
// This was four concatenated lines until 2026-09-04. `'a' + 'b'` widens to
// `string`, and supabase-js's `.select()` parser needs the LITERAL type to
// derive a row shape from it — given `string` it yields `GenericStringError`
// instead. Combined with the `as unknown as ConfirmRow` that used to sit below,
// that error was thrown away and THIS COLUMN LIST WAS NEVER CHECKED AGAINST THE
// SCHEMA AT ALL.
//
// ✅ Measured 2026-09-04, and it is better than that now: with the cast gone and
// the result ASSIGNED to `ConfirmRaw`, re-wrapping this into a concatenation no
// longer goes quiet — the assignment rejects `GenericStringError` and the build
// fails. What is lost is the DIAGNOSIS: as one literal, a typo reads
// `column 'pending_signature_ipp' does not exist on 'proposals'`; concatenated,
// the same typo is invisible and you get a shapeless type error instead.
const PENDING_COLUMNS =
  'id, token, ref_number, first_name, last_name, business_name, email, status, expires_at, services, brackets, tier_slug, addons, monthly_total_zar, vat_zar, total_charge_zar, client_org_id, sign_confirm_expires_at, pending_signature_name, pending_signature_method, pending_signature_image, pending_signature_ip';

type ConfirmRaw = Omit<ConfirmRow, 'brackets' | 'addons'> & {
  brackets: Json;
  addons: Json;
};

interface ConfirmRow extends FinalizeSignRow {
  expires_at: string | null;
  sign_confirm_expires_at: string | null;
}

// The legally binding commit, and the last step of the money path. It gets its
// own roomy bucket for the same reason as Step A: a shared office IP must never
// be the thing that stops a client signing. The one-time confirm token, bound
// to the proposal's own inbox, is the real gate.
const RATE_LIMIT_KEY = 'proposal-sign-confirm';
const CONFIRM_LIMIT = 30;

// One opaque token. Nothing else is read off this body.
const MAX_BODY_BYTES = 4 * 1024;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);

  const { allowed, retryAfter } = await checkRateLimit(ip, {
    key: RATE_LIMIT_KEY,
    limit: CONFIRM_LIMIT,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again in a few minutes.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  const read = await readJsonBody(req, MAX_BODY_BYTES);
  if (!read.ok) {
    return NextResponse.json({ error: read.error }, { status: read.status });
  }
  const body = read.body;

  const ctoken =
    body && typeof body === 'object' && 'ctoken' in body
      ? String((body as Record<string, unknown>).ctoken ?? '')
      : '';
  if (ctoken.length < 16) {
    return NextResponse.json(
      { error: 'This confirmation link is invalid.' },
      { status: 400 },
    );
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
        {
          error:
            'This confirmation link is no longer valid. It may already have been used.',
        },
        { status: 404 },
      );
    }
    // The two `jsonb` columns arrive as `Json`; everything else is checked
    // against the schema by this assignment. See lib/portal/proposalJson.ts.
    const raw: ConfirmRaw = data;
    row = {
      ...raw,
      brackets: bracketMapFromStored(raw.brackets, raw.id),
      addons: addonSlugsFromStored(raw.addons, raw.id),
    };
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
      {
        error:
          'This confirmation link has expired. Please sign again to get a fresh one.',
      },
      { status: 410 },
    );
  }
  if (
    row.status === 'signed' ||
    row.status === 'paid' ||
    row.status === 'active'
  ) {
    return NextResponse.json(
      { error: 'This proposal has already been signed.' },
      { status: 409 },
    );
  }

  const result = await finalizeProposalSignature(admin, row, ctoken);

  if (!result.ok) {
    if (result.outcome === 'already') {
      return NextResponse.json(
        { error: 'This proposal has already been signed.' },
        { status: 409 },
      );
    }
    if (result.outcome === 'invalid') {
      return NextResponse.json(
        {
          error: 'There is no pending signature to confirm. Please sign again.',
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'Could not finalise your signature. Please try again.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    provisioned: result.provisioned ?? false,
    deliveryStatus: result.deliveryStatus ?? 'pending',
  });
}
