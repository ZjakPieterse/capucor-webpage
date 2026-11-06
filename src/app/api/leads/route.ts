import { NextRequest, NextResponse } from 'next/server';
import { LeadSchema } from '@/lib/validations';
import { readJsonBody } from '@/lib/readJsonBody';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/getClientIp';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CONSENT_VERSION, CONSENT_LANGUAGE } from '@/lib/consent';
import { siteConfig } from '@/config/site';
import { sendEmail } from '@/lib/email/sendEmail';
import { buildLeadOwnerEmail } from '@/lib/email/messages.mjs';
import { dbErrorSummary } from '@/lib/log';

// Its own bucket. Sharing one counter across every public endpoint meant a
// visitor who resubmitted the contact form could exhaust the allowance that
// guards signing a proposal.
const RATE_LIMIT_KEY = 'leads';

// LeadSchema's longest field is `message` at 2000 chars, plus a calculator
// config of at most 20 services and their brackets. A real submission is a
// couple of KB; 16 KB is roomy enough that no honest form can hit it.
const MAX_BODY_BYTES = 16 * 1024;

export async function POST(req: NextRequest) {
  // 1. Per-IP rate limiting
  const ip = getClientIp(req.headers);

  const { allowed, retryAfter } = await checkRateLimit(ip, { key: RATE_LIMIT_KEY });
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again in a few minutes.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      },
    );
  }

  // 2. Parse body, under a hard byte cap
  const read = await readJsonBody(req, MAX_BODY_BYTES);
  if (!read.ok) {
    return NextResponse.json({ error: read.error }, { status: read.status });
  }
  const body = read.body;

  // 3. Honeypot — if website field is populated, silently succeed (do not insert)
  if (body && typeof body === 'object' && 'website' in body && (body as Record<string, unknown>).website) {
    return NextResponse.json({ ok: true });
  }

  // 4. Zod validation
  const parsed = LeadSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: firstIssue.message,
        field: firstIssue.path[0]?.toString(),
      },
      { status: 422 },
    );
  }

  // The /contact answers have no column of their own: they go in leads.config
  // (a contact lead carries no calculator config), so the owner email and the
  // retry runner render them with the rest of the row.
  const { website: _honeypot, answers, ...rest } = parsed.data;
  const fields = { ...rest, config: rest.config ?? answers };
  const leadId = crypto.randomUUID();

  // 5. Insert into Supabase
  try {
    const supabase = await createSupabaseServerClient();
    const { error: dbError } = await supabase.from('leads').insert({
      id: leadId,
      ...fields,
      // From v2 no consent is asked: consent_given keeps its default (false)
      // and consent_version records which privacy notice the visitor saw.
      consent_version: CONSENT_VERSION,
      consent_language: CONSENT_LANGUAGE,
    });

    if (dbError) throw dbError;
  } catch (err) {
    console.error('[LEADS] Supabase insert error:', dbErrorSummary(err));
    return NextResponse.json({ error: 'Could not save your enquiry. Please try again.' }, { status: 500 });
  }

  // 6. Notification email via Resend (optional — stubs to console if key absent)
  const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;

  if (ownerEmail) {
    const delivery = await sendEmail({
      sourceType: 'lead',
      sourceId: leadId,
      eventType: 'lead.owner_notification',
      idempotencyKey: `capucor_web_lead_owner_${leadId}`,
      message: {
        from: siteConfig.email.senderWebsite,
        to: ownerEmail,
        ...buildLeadOwnerEmail(fields),
      },
    });
    // Local dev only: the log would put personal information in Workers Logs.
    if (delivery.errorCode === 'missing_api_key' && process.env.NODE_ENV !== 'production') {
      console.log(`[LEAD] source=${fields.source} name=${fields.name} email=${fields.email}`);
    }
  } else {
    // No owner address set: log the row id only, never personal information.
    console.warn(`[LEAD] OWNER_NOTIFICATION_EMAIL not set; lead ${leadId} saved without a notification`);
  }

  return NextResponse.json({ ok: true });
}
