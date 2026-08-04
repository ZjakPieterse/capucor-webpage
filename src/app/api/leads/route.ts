import { NextRequest, NextResponse } from 'next/server';
import { LeadSchema } from '@/lib/validations';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/getClientIp';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CONSENT_VERSION, CONSENT_LANGUAGE } from '@/lib/consent';
import { siteConfig } from '@/config/site';
import { sendEmail } from '@/lib/email/sendEmail';

export async function POST(req: NextRequest) {
  // 1. Per-IP rate limiting
  const ip = getClientIp(req.headers);

  const { allowed, retryAfter } = await checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again in a few minutes.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      },
    );
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

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

  const { website: _honeypot, consent_given, ...fields } = parsed.data;
  const leadId = crypto.randomUUID();
  const consentTimestamp = new Date().toISOString();

  // 5. Insert into Supabase
  try {
    const supabase = await createSupabaseServerClient();
    const { error: dbError } = await supabase.from('leads').insert({
      id: leadId,
      ...fields,
      consent_given,
      consent_timestamp: consentTimestamp,
      consent_version: CONSENT_VERSION,
      consent_language: CONSENT_LANGUAGE,
    });

    if (dbError) throw dbError;
  } catch (err) {
    console.error('[LEADS] Supabase insert error:', err);
    return NextResponse.json({ error: 'Could not save your enquiry. Please try again.' }, { status: 500 });
  }

  // 6. Notification email via Resend (optional — stubs to console if key absent)
  const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;

  if (ownerEmail) {
    const delivery = await sendEmail({
      eventType: 'lead.owner_notification',
      idempotencyKey: `capucor_web_lead_owner_${leadId}`,
      message: {
        from: siteConfig.email.senderWebsite,
        to: ownerEmail,
        subject: `New lead: ${fields.name} (${fields.source})`,
        text: [
          `Source: ${fields.source}`,
          `Name: ${fields.name}`,
          `Email: ${fields.email}`,
          fields.business ? `Business: ${fields.business}` : null,
          fields.phone ? `Phone: ${fields.phone}` : null,
          fields.message ? `\nMessage:\n${fields.message}` : null,
          fields.config ? `\nConfig:\n${JSON.stringify(fields.config, null, 2)}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    });
    if (delivery.errorCode === 'missing_api_key') {
      console.log(`[LEAD] source=${fields.source} name=${fields.name} email=${fields.email}`);
    }
  } else {
    console.log(`[LEAD] source=${fields.source} name=${fields.name} email=${fields.email}`);
  }

  return NextResponse.json({ ok: true });
}
