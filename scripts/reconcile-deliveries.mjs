#!/usr/bin/env node
/**
 * The retry runner: finish signed-proposal fulfilment (PDF + the two "signed"
 * emails) and resend failed funnel emails, without installing dependencies.
 * Run by .github/workflows/cron-reconcile-deliveries.yml.
 *
 * Owned here since web-standalone phase 3 (2026-10-07); funnel sources only,
 * no portal stage. Why an Action and not the
 * Worker: Workers Free gives 10 ms CPU and 50 subrequests per request, and a
 * full fulfilment needs more of both (decision 2026-08-03: background jobs run
 * on GitHub Actions as zero-dependency .mjs over PostgREST).
 *
 * The Worker persists delivery METADATA only (src/lib/email/sendEmail.ts). This
 * runner reloads the source row, rebuilds the message with the same
 * dependency-free renderers (src/lib/email/messages.mjs), claims work by
 * compare-and-swap and reuses the ORIGINAL Resend idempotency key, so a send the
 * provider already accepted is not delivered twice. The PDF is rendered by the
 * Worker: this runner calls /api/internal/proposal-fulfilment/pdf with a
 * body-bound HMAC, so the Apps Script credential never leaves the Worker.
 *
 * ⚠️ THIS REPOSITORY IS PUBLIC, SO ITS ACTION LOGS ARE PUBLIC. Log ids, event
 * types, counts and error codes only — never a recipient, a link token, a
 * message body or a provider error message.
 */

import { createHmac } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  EMAIL_REPLY_TO,
  EMAIL_SENDER,
  PRIVACY_SENDER,
  SIGNED_CLIENT_EVENT,
  SIGNED_OWNER_EVENT,
  WEBSITE_SENDER,
  buildSignedClientMessage,
  buildSignedOwnerMessage,
  renderCreatedProposalClientEmail,
  renderCreatedProposalOwnerText,
  renderDataRequestConfirmationText,
  renderDataRequestConfirmedOwnerText,
  renderDataRequestPendingOwnerText,
  renderLeadOwnerText,
  renderSignConfirmEmail,
  signedClientIdempotencyKey,
  signedOwnerIdempotencyKey,
} from '../src/lib/email/messages.mjs';

export const MAX_ATTEMPTS = 6;
export const LEASE_MS = 60_000;
export const PROVIDER_TIMEOUT_MS = 8_000;
export const AMBIGUOUS_WINDOW_MS = 23 * 60 * 60 * 1000;
export const MAX_FULFILMENT_STAGE_ATTEMPTS = 6;
const FIRST_RETRY_MS = 10 * 60_000;
const MAX_RETRY_MS = 6 * 60 * 60_000;
const MAX_BATCH = 50;
const MAX_FULFILMENT_BATCH = 20;
const MAX_ERROR_LENGTH = 2_000;
const DATA_REQUEST_TOKEN_TTL_HOURS = 24;
const DATA_REQUEST_SLA_DAYS = 30;

// The email sources this repository creates. email_deliveries is shared with
// the legacy portal (`request_email`, `approval`) until os-sunset; those rows
// are not ours and are never claimed, rebuilt or failed here.
export const FUNNEL_SOURCES = ['lead', 'data_request', 'proposal'];

const AMBIGUOUS_CODES = new Set([
  'timeout',
  'transport_error',
  'invalid_provider_response',
]);

export class PermanentDeliveryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PermanentDeliveryError';
    this.code = code;
  }
}

function truncate(value) {
  return String(value).slice(0, MAX_ERROR_LENGTH);
}

export function retryAt(attemptCount, from = Date.now()) {
  const delay = Math.min(
    FIRST_RETRY_MS * 2 ** Math.max(0, attemptCount - 1),
    MAX_RETRY_MS,
  );
  return new Date(from + delay).toISOString();
}

// Resend keeps an idempotency key for 24 hours. A send whose outcome is unknown
// (timeout, transport error) and older than that can no longer be retried
// safely: the provider would treat it as new and might deliver it twice.
export function isAmbiguousOutsideProviderWindow(row, now = Date.now()) {
  const ambiguous =
    row.status === 'processing' ||
    (row.last_error_code && AMBIGUOUS_CODES.has(row.last_error_code));
  return (
    ambiguous && now - new Date(row.created_at).getTime() >= AMBIGUOUS_WINDOW_MS
  );
}

export function isRetryableProviderResponse(status, code) {
  return (
    status === 408 ||
    status === 429 ||
    status >= 500 ||
    code === 'concurrent_idempotent_requests'
  );
}

export class Postgrest {
  constructor(baseUrl, serviceKey) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    // apikey only. A new-style secret key is not a JWT, so it must not be sent
    // as a Bearer token.
    this.headers = {
      apikey: serviceKey,
      'Content-Type': 'application/json',
    };
  }

  async request(table, { method = 'GET', params = {}, body, prefer } = {}) {
    const url = new URL(`${this.baseUrl}/rest/v1/${table}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null)
        url.searchParams.set(key, String(value));
    }
    const response = await fetch(url, {
      method,
      headers: { ...this.headers, ...(prefer ? { Prefer: prefer } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    if (!response.ok) {
      // The status and PostgREST/Postgres error code only: a constraint error's
      // detail can quote the failing row, and this message can reach a public log.
      let code = '';
      try {
        code = (await response.json())?.code ?? '';
      } catch {
        code = '';
      }
      throw new Error(
        `PostgREST ${method} ${table} failed (${response.status}${code ? ` ${code}` : ''}).`,
      );
    }
    if (response.status === 204) return [];
    const text = await response.text();
    return text ? JSON.parse(text) : [];
  }

  // `idColumn` is not decoration: proposal_fulfilment is keyed by
  // `proposal_id` and has no `id` column. Defaulting to `id` there once made
  // every recovery lookup 400 and reschedule forever (2026-08).
  async one(table, id, select = '*', idColumn = 'id') {
    const rows = await this.request(table, {
      params: { select, [idColumn]: `eq.${id}`, limit: 1 },
    });
    if (rows.length !== 1) {
      throw new PermanentDeliveryError(
        'source_not_found',
        `Source row is missing from ${table}.`,
      );
    }
    return rows[0];
  }

  async rpc(name, body) {
    return this.request(`rpc/${name}`, { method: 'POST', body });
  }

  async maybeOne(table, params, select = '*') {
    const rows = await this.request(table, {
      params: { select, ...params, limit: 1 },
    });
    return rows[0] ?? null;
  }

  async deliveries(params) {
    return this.request('email_deliveries', {
      params: { select: '*', ...params },
    });
  }

  async patchDelivery(row, values, dueAt) {
    const dueColumn =
      row.status === 'processing' ? 'lease_expires_at' : 'next_attempt_at';
    return this.request('email_deliveries', {
      method: 'PATCH',
      params: {
        select: '*',
        id: `eq.${row.id}`,
        status: `eq.${row.status}`,
        attempt_count: `eq.${row.attempt_count}`,
        [dueColumn]: `lte.${dueAt}`,
      },
      body: values,
      prefer: 'return=representation',
    });
  }

  async finishDelivery(claimed, leaseToken, values) {
    return this.request('email_deliveries', {
      method: 'PATCH',
      params: {
        select: 'id',
        id: `eq.${claimed.id}`,
        status: 'eq.processing',
        attempt_count: `eq.${claimed.attempt_count}`,
        lease_token: `eq.${leaseToken}`,
      },
      body: values,
      prefer: 'return=representation',
    });
  }

  async deliveryStatusAt(sourceType, sourceId, eventType, cutoff) {
    const rows = await this.deliveries({
      source_type: `eq.${sourceType}`,
      source_id: `eq.${sourceId}`,
      event_type: `eq.${eventType}`,
      order: 'created_at.asc',
      limit: 1,
    });
    const acceptedAt = rows[0]?.accepted_at;
    return acceptedAt &&
      new Date(acceptedAt).getTime() <= new Date(cutoff).getTime()
      ? 'accepted'
      : 'pending';
  }
}

function assertRecipient(row, expected) {
  if (row.recipient !== String(expected).trim().toLowerCase()) {
    throw new PermanentDeliveryError(
      'recipient_changed',
      'The source recipient no longer matches the event.',
    );
  }
}

function tierName(slug) {
  const known = { basic: 'Basic', pro: 'Pro', premium: 'Premium' };
  return (
    known[slug] ??
    String(slug)
      .split(/[-_]/)
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
      .join(' ')
  );
}

function priceFor(bracket, tierSlug) {
  if (tierSlug === 'pro') return Number(bracket.pro_price);
  if (tierSlug === 'premium') return Number(bracket.premium_price);
  return Number(bracket.basic_price);
}

async function proposalLineItems(proposal, db) {
  const brackets = await db.request('brackets', {
    params: {
      select: 'service_slug,ordinal,label,basic_price,pro_price,premium_price',
      order: 'service_slug.asc,ordinal.asc',
    },
  });
  const selected = proposal.brackets ?? {};
  const lines = [];
  for (const slug of proposal.services ?? []) {
    const ordinal = selected[slug];
    if (ordinal === undefined || ordinal === 'enterprise') continue;
    const bracket = brackets.find(
      (candidate) =>
        candidate.service_slug === slug &&
        Number(candidate.ordinal) === Number(ordinal),
    );
    if (!bracket) {
      throw new PermanentDeliveryError(
        'pricing_source_missing',
        'A proposal bracket is no longer available.',
      );
    }
    lines.push({
      name: String(slug)
        .split(/[-_]/)
        .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
        .join(' '),
      label: bracket.label ?? null,
      price: priceFor(bracket, proposal.tier_slug),
    });
  }
  for (const addon of proposal.addons ?? []) {
    if (addon === 'dext')
      lines.push({ name: 'Dext Software Access', label: null, price: 375 });
  }
  return lines;
}

// ── Signed-proposal fulfilment ──────────────────────────────────────────────

export async function archiveProposalPdf(db, proposal, config) {
  if (proposal.proposal_pdf_drive_id) {
    return { ok: true, fileId: proposal.proposal_pdf_drive_id };
  }
  if (!proposal.signed_at) {
    return {
      ok: false,
      code: 'proposal_not_signed',
      message: 'The proposal has no signed timestamp.',
    };
  }

  let response;
  try {
    const timestamp = String(Date.now());
    const signature = createHmac('sha256', config.serviceKey)
      .update(`${timestamp}.${proposal.id}`)
      .digest('hex');
    response = await fetch(
      `${config.marketingUrl.replace(/\/$/, '')}/api/internal/proposal-fulfilment/pdf`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-capucor-timestamp': timestamp,
          'x-capucor-signature': signature,
        },
        body: JSON.stringify({ proposalId: proposal.id }),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      },
    );
  } catch (error) {
    return {
      ok: false,
      code:
        error?.name === 'TimeoutError'
          ? 'pdf_bridge_timeout'
          : 'pdf_bridge_transport_error',
      message:
        error instanceof Error
          ? error.message
          : 'PDF reconciliation bridge transport failed.',
    };
  }
  let output = {};
  try {
    output = await response.json();
  } catch {
    output = {};
  }
  if (!response.ok || !output.ok || !output.fileId) {
    return {
      ok: false,
      code: response.ok
        ? 'pdf_bridge_rejected'
        : `pdf_bridge_http_${response.status}`,
      message:
        output.error ??
        `PDF reconciliation bridge responded ${response.status}.`,
    };
  }

  // The Worker records the id itself; this is the belt to its braces.
  await db.request('proposals', {
    method: 'PATCH',
    params: { id: `eq.${proposal.id}`, proposal_pdf_drive_id: 'is.null' },
    body: { proposal_pdf_drive_id: output.fileId },
  });
  return { ok: true, fileId: output.fileId };
}

async function ensureFulfilmentDelivery(db, proposal, stage, ownerEmail) {
  const client = stage === 'client_email';
  const recipient = client ? proposal.email : ownerEmail;
  if (!recipient) return null;
  const eventType = client ? SIGNED_CLIENT_EVENT : SIGNED_OWNER_EVENT;
  const idempotencyKey = client
    ? signedClientIdempotencyKey(proposal.id)
    : signedOwnerIdempotencyKey(proposal.id);
  const existing = await db.maybeOne('email_deliveries', {
    idempotency_key: `eq.${idempotencyKey}`,
  });
  if (existing) return existing;

  const rows = await db.request('email_deliveries', {
    method: 'POST',
    params: { on_conflict: 'idempotency_key' },
    body: {
      id: crypto.randomUUID(),
      source_type: 'proposal',
      source_id: proposal.id,
      event_type: eventType,
      recipient: String(recipient).trim().toLowerCase(),
      idempotency_key: idempotencyKey,
      status: 'pending',
      attempt_count: 0,
      next_attempt_at: new Date().toISOString(),
    },
    prefer: 'resolution=ignore-duplicates,return=representation',
  });
  return (
    rows[0] ??
    db.maybeOne('email_deliveries', { idempotency_key: `eq.${idempotencyKey}` })
  );
}

async function claimFulfilmentStage(db, proposalId) {
  const leaseToken = crypto.randomUUID();
  const rows = await db.rpc('claim_proposal_fulfilment_stage', {
    p_proposal_id: proposalId,
    p_lease_token: leaseToken,
    p_lease_expires_at: new Date(Date.now() + LEASE_MS).toISOString(),
  });
  return rows[0] ? { ...rows[0], leaseToken } : null;
}

async function finishFulfilmentStage(db, claim, outcome, details = {}) {
  return db.rpc('finish_proposal_fulfilment_stage', {
    p_proposal_id: claim.proposal_id,
    p_lease_token: claim.leaseToken,
    p_stage: claim.stage,
    p_outcome: outcome,
    p_finished_at: new Date().toISOString(),
    p_next_attempt_at: details.nextAttemptAt ?? null,
    p_delivery_id: details.deliveryId ?? null,
    p_error_code: details.errorCode ?? null,
    p_error_message: details.errorMessage
      ? truncate(details.errorMessage)
      : null,
  });
}

/**
 * Advance one signed proposal through pdf → client_email → owner_email. The
 * email stages only ensure the delivery row exists and mirror its state; the
 * delivery pass below sends it, and sync_proposal_fulfilment_email projects the
 * outcome back, after which the next stage becomes due.
 */
export async function reconcileFulfilmentOne(db, proposalId, config) {
  const outcomes = [];
  for (let step = 0; step < 3; step += 1) {
    const claim = await claimFulfilmentStage(db, proposalId);
    if (!claim) break;
    try {
      if (!['pdf', 'client_email', 'owner_email'].includes(claim.stage)) {
        throw new Error(`Unknown fulfilment stage "${claim.stage}".`);
      }
      const proposal = await db.one(
        'proposals',
        proposalId,
        'id,email,signed_at,proposal_pdf_drive_id',
      );

      if (claim.stage === 'pdf') {
        const result = await archiveProposalPdf(db, proposal, config);
        if (!result.ok) {
          const permanent = claim.attempt_count >= MAX_FULFILMENT_STAGE_ATTEMPTS;
          await finishFulfilmentStage(
            db,
            claim,
            permanent ? 'permanently_failed' : 'retry_scheduled',
            {
              nextAttemptAt: permanent ? null : retryAt(claim.attempt_count),
              errorCode: permanent ? 'max_attempts_exhausted' : result.code,
              errorMessage: permanent
                ? `PDF archival exhausted ${MAX_FULFILMENT_STAGE_ATTEMPTS} attempts: ${result.message}`
                : result.message,
            },
          );
          outcomes.push(
            permanent ? 'pdf_permanently_failed' : 'pdf_retry_scheduled',
          );
          break;
        }
        await finishFulfilmentStage(db, claim, 'success');
        outcomes.push('pdf_complete');
        continue;
      }

      if (claim.stage === 'owner_email' && !config.ownerEmail) {
        await finishFulfilmentStage(db, claim, 'not_required');
        outcomes.push('owner_email_not_required');
        continue;
      }

      const fulfilment = await db.one(
        'proposal_fulfilment',
        proposalId,
        'client_email_delivery_id,owner_email_delivery_id',
        'proposal_id',
      );
      const deliveryId =
        claim.stage === 'client_email'
          ? fulfilment.client_email_delivery_id
          : fulfilment.owner_email_delivery_id;
      const delivery = deliveryId
        ? await db.one('email_deliveries', deliveryId)
        : await ensureFulfilmentDelivery(
            db,
            proposal,
            claim.stage,
            config.ownerEmail,
          );
      if (!delivery) throw new Error('Email delivery could not be persisted.');

      if (delivery.status === 'accepted') {
        await finishFulfilmentStage(db, claim, 'success', {
          deliveryId: delivery.id,
        });
        outcomes.push(`${claim.stage}_accepted`);
        continue;
      }
      if (delivery.status === 'permanently_failed') {
        await finishFulfilmentStage(db, claim, 'permanently_failed', {
          deliveryId: delivery.id,
          errorCode: delivery.last_error_code ?? 'email_permanently_failed',
          errorMessage:
            delivery.last_error_message ?? 'Email delivery permanently failed.',
        });
        outcomes.push(`${claim.stage}_permanently_failed`);
        break;
      }
      await finishFulfilmentStage(db, claim, 'retry_scheduled', {
        nextAttemptAt: delivery.next_attempt_at,
        deliveryId: delivery.id,
        errorCode: delivery.last_error_code ?? 'email_pending',
        errorMessage:
          delivery.last_error_message ??
          'Email delivery is pending reconciliation.',
      });
      outcomes.push(`${claim.stage}_pending`);
      break;
    } catch (error) {
      const permanent = claim.attempt_count >= MAX_FULFILMENT_STAGE_ATTEMPTS;
      await finishFulfilmentStage(
        db,
        claim,
        permanent ? 'permanently_failed' : 'retry_scheduled',
        {
          nextAttemptAt: permanent ? null : retryAt(claim.attempt_count),
          errorCode: permanent
            ? 'max_attempts_exhausted'
            : `${claim.stage}_failed`,
          errorMessage:
            error instanceof Error ? error.message : 'Fulfilment stage failed.',
        },
      );
      outcomes.push(
        permanent
          ? `${claim.stage}_permanently_failed`
          : `${claim.stage}_retry_scheduled`,
      );
      break;
    }
  }
  return outcomes;
}

async function dueFulfilments(db, nowIso) {
  const [scheduled, stale] = await Promise.all([
    db.request('proposal_fulfilment', {
      params: {
        select: 'proposal_id,created_at',
        completed_at: 'is.null',
        lease_token: 'is.null',
        next_attempt_at: `lte.${nowIso}`,
        order: 'created_at.asc',
        limit: MAX_FULFILMENT_BATCH,
      },
    }),
    db.request('proposal_fulfilment', {
      params: {
        select: 'proposal_id,created_at',
        completed_at: 'is.null',
        lease_expires_at: `lte.${nowIso}`,
        order: 'created_at.asc',
        limit: MAX_FULFILMENT_BATCH,
      },
    }),
  ]);
  const unique = new Map(
    [...scheduled, ...stale].map((row) => [row.proposal_id, row]),
  );
  return [...unique.values()]
    .sort((left, right) => left.created_at.localeCompare(right.created_at))
    .slice(0, MAX_FULFILMENT_BATCH);
}

// ── Rebuilding a message from its source row ─────────────────────────────────

async function buildLeadMessage(row, db) {
  if (row.event_type !== 'lead.owner_notification') {
    throw new PermanentDeliveryError(
      'unsupported_event',
      'Unknown lead email event.',
    );
  }
  const lead = await db.one(
    'leads',
    row.source_id,
    'id,source,name,email,business,phone,message,config',
  );
  return {
    from: WEBSITE_SENDER,
    to: row.recipient,
    subject: `New lead: ${lead.name} (${lead.source})`,
    text: renderLeadOwnerText(lead),
  };
}

async function buildDataRequestMessage(row, db, marketingUrl) {
  const request = await db.one(
    'data_requests',
    row.source_id,
    'id,email,request_type,status,token,token_expires_at,ip_address,confirmed_at',
  );
  const requestType = request.request_type;
  if (row.event_type === 'data_request.confirmation_client') {
    assertRecipient(row, request.email);
    if (!request.token) {
      throw new PermanentDeliveryError(
        'source_token_missing',
        'The data-request token is missing.',
      );
    }
    const confirmUrl = `${marketingUrl}/api/data-request/confirm?token=${encodeURIComponent(request.token)}`;
    return {
      from: PRIVACY_SENDER,
      replyTo: EMAIL_REPLY_TO,
      to: row.recipient,
      subject:
        requestType === 'delete'
          ? 'Confirm your data deletion request'
          : 'Confirm your data access request',
      text: renderDataRequestConfirmationText({
        requestType,
        confirmUrl,
        tokenTtlHours: DATA_REQUEST_TOKEN_TTL_HOURS,
        slaDays: DATA_REQUEST_SLA_DAYS,
      }),
    };
  }
  if (row.event_type === 'data_request.pending_owner') {
    const requesterDeliveryStatus = await db.deliveryStatusAt(
      'data_request',
      request.id,
      'data_request.confirmation_client',
      row.created_at,
    );
    return {
      from: WEBSITE_SENDER,
      to: row.recipient,
      subject: `Data ${requestType} request: ${request.email}`,
      text: renderDataRequestPendingOwnerText({
        requestType,
        email: request.email,
        ipAddress: request.ip_address,
        tokenTtlHours: DATA_REQUEST_TOKEN_TTL_HOURS,
        requesterDeliveryStatus,
      }),
    };
  }
  if (row.event_type === 'data_request.confirmed_owner') {
    if (!request.confirmed_at) {
      throw new PermanentDeliveryError(
        'source_state_invalid',
        'The data request is not confirmed.',
      );
    }
    return {
      from: WEBSITE_SENDER,
      to: row.recipient,
      subject: `Data ${requestType} request CONFIRMED: ${request.email}`,
      text: renderDataRequestConfirmedOwnerText({
        requestType,
        email: request.email,
        confirmedAt: request.confirmed_at,
        slaDays: DATA_REQUEST_SLA_DAYS,
      }),
    };
  }
  throw new PermanentDeliveryError(
    'unsupported_event',
    'Unknown data-request email event.',
  );
}

async function buildProposalMessage(row, db, marketingUrl) {
  const proposal = await db.one(
    'proposals',
    row.source_id,
    'id,token,ref_number,first_name,last_name,business_name,email,status,services,brackets,tier_slug,addons,total_charge_zar,monthly_total_zar,sent_at,signed_at,sign_confirm_token,sign_confirm_expires_at,proposal_pdf_drive_id',
  );
  const proposalUrl = `${marketingUrl}/proposal/${proposal.token}`;
  const refSuffix = proposal.ref_number ? ` (${proposal.ref_number})` : '';
  if (row.event_type.endsWith('_client')) assertRecipient(row, proposal.email);

  if (
    row.event_type === 'proposal.created_client' ||
    row.event_type === 'proposal.created_owner'
  ) {
    const lineItems = await proposalLineItems(proposal, db);
    const common = {
      refNumber: proposal.ref_number,
      businessName: proposal.business_name,
      tierName: tierName(proposal.tier_slug),
      lineItems,
      totalChargeZAR: Number(proposal.total_charge_zar),
      proposalUrl,
    };
    if (row.event_type === 'proposal.created_client') {
      return {
        from: EMAIL_SENDER,
        replyTo: EMAIL_REPLY_TO,
        to: row.recipient,
        subject: proposal.ref_number
          ? `Your Capucor proposal (${proposal.ref_number}) is ready`
          : 'Your Capucor proposal is ready',
        html: renderCreatedProposalClientEmail({
          ...common,
          firstName: proposal.first_name,
          firstDebitFrom: proposal.sent_at ?? row.created_at,
        }),
      };
    }
    const clientDeliveryStatus = await db.deliveryStatusAt(
      'proposal',
      proposal.id,
      'proposal.created_client',
      row.created_at,
    );
    return {
      from: WEBSITE_SENDER,
      to: row.recipient,
      subject: `New proposal: ${proposal.business_name}${refSuffix}`,
      text: renderCreatedProposalOwnerText({
        ...common,
        fullName: `${proposal.first_name} ${proposal.last_name}`.trim(),
        email: proposal.email,
        clientDeliveryStatus,
      }),
    };
  }

  if (row.event_type === 'proposal.sign_confirmation_client') {
    if (!proposal.sign_confirm_token || !proposal.sign_confirm_expires_at) {
      throw new PermanentDeliveryError(
        'source_token_missing',
        'The signing confirmation cycle is no longer active.',
      );
    }
    const expectedKey = `capucor_web_sign_confirm_client_${proposal.id}_${new Date(proposal.sign_confirm_expires_at).getTime()}`;
    if (row.idempotency_key !== expectedKey) {
      throw new PermanentDeliveryError(
        'source_cycle_replaced',
        'A newer signing confirmation cycle replaced this event.',
      );
    }
    return {
      from: EMAIL_SENDER,
      replyTo: EMAIL_REPLY_TO,
      to: row.recipient,
      subject: 'Confirm your Capucor signature',
      html: renderSignConfirmEmail({
        firstName: proposal.first_name,
        businessName: proposal.business_name,
        refNumber: proposal.ref_number,
        confirmUrl: `${marketingUrl}/proposal/confirm/${proposal.sign_confirm_token}`,
      }),
    };
  }

  if (
    row.event_type === SIGNED_CLIENT_EVENT ||
    row.event_type === SIGNED_OWNER_EVENT
  ) {
    if (!proposal.signed_at) {
      throw new PermanentDeliveryError(
        'source_state_invalid',
        'The proposal has no signed timestamp.',
      );
    }
    // The same builders as the Worker's first attempt (lib/portal/fulfilment.ts).
    return row.event_type.endsWith('_client')
      ? buildSignedClientMessage(proposal)
      : buildSignedOwnerMessage(proposal, row.recipient);
  }

  throw new PermanentDeliveryError(
    'unsupported_event',
    'Unknown proposal email event.',
  );
}

export async function buildDeliveryMessage(row, db, options = {}) {
  const marketingUrl = (options.marketingUrl ?? 'https://capucor.com').replace(
    /\/$/,
    '',
  );
  if (row.source_type === 'lead') return buildLeadMessage(row, db);
  if (row.source_type === 'data_request')
    return buildDataRequestMessage(row, db, marketingUrl);
  if (row.source_type === 'proposal')
    return buildProposalMessage(row, db, marketingUrl);
  throw new PermanentDeliveryError(
    'unsupported_source',
    'Unknown delivery source type.',
  );
}

// ── Sending ──────────────────────────────────────────────────────────────────

export function toResendPayload(message) {
  // Match Resend SDK 6.x's parseEmailToApiOptions field order as well as its
  // names. This keeps the retry request identical to the Worker's SDK request
  // even if the provider hashes the serialised body rather than a normalised
  // JSON object.
  return {
    attachments: undefined,
    bcc: undefined,
    cc: undefined,
    from: message.from,
    headers: undefined,
    html: message.html,
    reply_to: message.replyTo,
    scheduled_at: undefined,
    subject: message.subject,
    tags: undefined,
    text: message.text,
    to: message.to,
    template: undefined,
    topic_id: undefined,
  };
}

async function sendToResend(apiKey, message, idempotencyKey) {
  let response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(toResendPayload(message)),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
  } catch (error) {
    return {
      ok: false,
      code: error?.name === 'TimeoutError' ? 'timeout' : 'transport_error',
      message:
        error instanceof Error
          ? error.message
          : 'Unknown email transport error.',
      retryable: true,
    };
  }

  let responseBody = {};
  try {
    responseBody = await response.json();
  } catch {
    responseBody = {};
  }
  if (response.ok && responseBody.id)
    return { ok: true, providerId: responseBody.id };
  const code =
    responseBody.name ?? responseBody.code ?? `http_${response.status}`;
  const messageText =
    responseBody.message ?? `Resend responded with ${response.status}.`;
  return {
    ok: false,
    code,
    message: messageText,
    retryable: isRetryableProviderResponse(response.status, code),
  };
}

async function permanentlyFail(db, row, code, message, dueAt) {
  const rows = await db.patchDelivery(
    row,
    {
      status: 'permanently_failed',
      failed_at: new Date().toISOString(),
      last_error_code: truncate(code),
      last_error_message: truncate(message),
      lease_token: null,
      lease_expires_at: null,
    },
    dueAt,
  );
  return rows.length === 1;
}

async function claim(db, row, dueAt) {
  const leaseToken = crypto.randomUUID();
  const rows = await db.patchDelivery(
    row,
    {
      status: 'processing',
      attempt_count: row.attempt_count + 1,
      last_attempt_at: new Date().toISOString(),
      lease_token: leaseToken,
      lease_expires_at: new Date(Date.now() + LEASE_MS).toISOString(),
    },
    dueAt,
  );
  return rows.length === 1 ? { row: rows[0], leaseToken } : null;
}

async function syncFulfilment(db, row) {
  if (row.source_type !== 'proposal') return;
  await db.rpc('sync_proposal_fulfilment_email', { p_delivery_id: row.id });
}

export async function reconcileOne(db, row, config, dueAt) {
  if (row.attempt_count >= MAX_ATTEMPTS) {
    const failed = await permanentlyFail(
      db,
      row,
      'max_attempts_exhausted',
      `Email delivery exhausted ${MAX_ATTEMPTS} attempts.`,
      dueAt,
    );
    if (failed) await syncFulfilment(db, row);
    return failed ? 'permanently_failed' : 'lost_claim';
  }
  if (isAmbiguousOutsideProviderWindow(row)) {
    const failed = await permanentlyFail(
      db,
      row,
      'idempotency_window_elapsed',
      'An ambiguous provider attempt is older than the safe idempotency window.',
      dueAt,
    );
    if (failed) await syncFulfilment(db, row);
    return failed ? 'permanently_failed' : 'lost_claim';
  }

  const claimed = await claim(db, row, dueAt);
  if (!claimed) return 'lost_claim';
  let message;
  try {
    message = await buildDeliveryMessage(claimed.row, db, config);
  } catch (error) {
    const code =
      error instanceof PermanentDeliveryError
        ? error.code
        : 'message_rebuild_failed';
    const detail =
      error instanceof Error ? error.message : 'Message reconstruction failed.';
    const rows = await db.finishDelivery(claimed.row, claimed.leaseToken, {
      status: 'permanently_failed',
      failed_at: new Date().toISOString(),
      last_error_code: truncate(code),
      last_error_message: truncate(detail),
      lease_token: null,
      lease_expires_at: null,
    });
    if (rows.length === 1) await syncFulfilment(db, claimed.row);
    return rows.length === 1 ? 'permanently_failed' : 'lost_claim';
  }

  const provider = await sendToResend(
    config.resendApiKey,
    message,
    claimed.row.idempotency_key,
  );
  if (provider.ok) {
    const acceptedAt = new Date().toISOString();
    const rows = await db.finishDelivery(claimed.row, claimed.leaseToken, {
      status: 'accepted',
      provider_id: provider.providerId,
      accepted_at: acceptedAt,
      failed_at: null,
      last_error_code: null,
      last_error_message: null,
      lease_token: null,
      lease_expires_at: null,
    });
    if (rows.length !== 1) return 'lost_claim';
    if (
      claimed.row.source_type === 'proposal' &&
      claimed.row.event_type === SIGNED_CLIENT_EVENT
    ) {
      await db.request('proposals', {
        method: 'PATCH',
        params: {
          id: `eq.${claimed.row.source_id}`,
          signed_email_sent_at: 'is.null',
        },
        body: { signed_email_sent_at: acceptedAt },
      });
    }
    await syncFulfilment(db, claimed.row);
    return 'accepted';
  }

  const permanent =
    !provider.retryable || claimed.row.attempt_count >= MAX_ATTEMPTS;
  const rows = await db.finishDelivery(claimed.row, claimed.leaseToken, {
    status: permanent ? 'permanently_failed' : 'retry_scheduled',
    failed_at: permanent ? new Date().toISOString() : null,
    last_error_code: truncate(provider.code),
    last_error_message: truncate(provider.message),
    next_attempt_at: retryAt(claimed.row.attempt_count),
    lease_token: null,
    lease_expires_at: null,
  });
  if (rows.length !== 1) return 'lost_claim';
  if (permanent) await syncFulfilment(db, claimed.row);
  return permanent ? 'permanently_failed' : 'retry_scheduled';
}

async function dueDeliveries(db, nowIso) {
  const sources = `in.(${FUNNEL_SOURCES.join(',')})`;
  const [scheduled, stale] = await Promise.all([
    db.deliveries({
      source_type: sources,
      status: 'in.(pending,retry_scheduled)',
      next_attempt_at: `lte.${nowIso}`,
      order: 'created_at.asc',
      limit: MAX_BATCH,
    }),
    db.deliveries({
      source_type: sources,
      status: 'eq.processing',
      lease_expires_at: `lte.${nowIso}`,
      order: 'created_at.asc',
      limit: MAX_BATCH,
    }),
  ]);
  return [...scheduled, ...stale]
    .sort((left, right) => left.created_at.localeCompare(right.created_at))
    .slice(0, MAX_BATCH);
}

/**
 * One run: fulfilments first (so a new delivery row is due in the same run),
 * then due deliveries. Returns the counts; `newPermanent` is what THIS run
 * failed permanently, which is what fails the job (see main).
 */
export async function runOnce(db, config, log = console.log) {
  const due = await dueFulfilments(db, new Date().toISOString());
  const fulfilmentOutcomes = [];
  for (const row of due) {
    const result = await reconcileFulfilmentOne(db, row.proposal_id, config);
    fulfilmentOutcomes.push(...result);
    log(
      `fulfilment=${row.proposal_id} outcomes=${result.join(',') || 'lost_claim'}`,
    );
  }

  const nowIso = new Date().toISOString();
  const deliveries = await dueDeliveries(db, nowIso);
  const counts = {
    accepted: 0,
    retry_scheduled: 0,
    permanently_failed: 0,
    lost_claim: 0,
  };
  for (const row of deliveries) {
    const outcome = await reconcileOne(db, row, config, nowIso);
    counts[outcome] += 1;
    log(`delivery=${row.id} event=${row.event_type} outcome=${outcome}`);
  }

  return {
    fulfilmentsDue: due.length,
    fulfilmentOutcomes,
    deliveriesDue: deliveries.length,
    counts,
    newPermanent:
      counts.permanently_failed +
      fulfilmentOutcomes.filter((o) => o.endsWith('_permanently_failed'))
        .length,
  };
}

async function main() {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!baseUrl || !serviceKey || !resendApiKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and RESEND_API_KEY are required.',
    );
  }
  const db = new Postgrest(baseUrl, serviceKey);
  const config = {
    serviceKey,
    resendApiKey,
    marketingUrl: process.env.NEXT_PUBLIC_MARKETING_URL || 'https://capucor.com',
    ownerEmail: process.env.OWNER_NOTIFICATION_EMAIL || null,
  };
  const run = await runOnce(db, config);

  // Every permanent failure on record, for the summary. Listed as warnings, not
  // failures: GitHub emails on a failed run, so the run fails only for what it
  // failed itself. Failing on every old row would keep each run red until the
  // row was cleaned up by hand, and the watchdog would then read this cron as
  // stale and hide a real stop behind a known failure.
  const [oldDeliveries, oldFulfilments] = await Promise.all([
    db.deliveries({
      select: 'id,event_type,attempt_count,last_error_code',
      source_type: `in.(${FUNNEL_SOURCES.join(',')})`,
      status: 'eq.permanently_failed',
      order: 'failed_at.asc',
      limit: 100,
    }),
    db.request('proposal_fulfilment', {
      params: {
        select: 'proposal_id,last_error_stage,last_error_code',
        or: '(pdf_status.eq.permanently_failed,client_email_status.eq.permanently_failed,owner_email_status.eq.permanently_failed)',
        order: 'updated_at.asc',
        limit: 100,
      },
    }),
  ]);
  for (const f of oldDeliveries) {
    console.log(
      `::warning::delivery=${f.id} event=${f.event_type} attempts=${f.attempt_count} code=${f.last_error_code} is permanently failed`,
    );
  }
  for (const f of oldFulfilments) {
    console.log(
      `::warning::fulfilment=${f.proposal_id} stage=${f.last_error_stage} code=${f.last_error_code} is permanently failed`,
    );
  }

  console.log(
    `Reconciliation complete: fulfilments_due=${run.fulfilmentsDue} fulfilment_stage_outcomes=${run.fulfilmentOutcomes.length} emails_due=${run.deliveriesDue} accepted=${run.counts.accepted} retry_scheduled=${run.counts.retry_scheduled} permanently_failed=${run.counts.permanently_failed} lost_claim=${run.counts.lost_claim}.`,
  );
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      '## Signed-proposal fulfilment and email retries',
      '',
      `- Fulfilments due: ${run.fulfilmentsDue}`,
      `- Fulfilment stage outcomes: ${run.fulfilmentOutcomes.length}`,
      `- Emails due: ${run.deliveriesDue}`,
      `- Accepted: ${run.counts.accepted}`,
      `- Retry scheduled: ${run.counts.retry_scheduled}`,
      `- Lost claims: ${run.counts.lost_claim}`,
      `- Permanently failed this run: ${run.newPermanent}`,
      `- Permanently failed on record: ${oldDeliveries.length} email(s), ${oldFulfilments.length} fulfilment(s)`,
    ];
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `${lines.join('\n')}\n`,
      'utf8',
    );
  }
  if (run.newPermanent > 0) {
    console.error(
      `::error::${run.newPermanent} item(s) failed permanently in this run; see the warnings above and the email_deliveries / proposal_fulfilment rows.`,
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(
      `::error::Reconciliation failed: ${truncate(error instanceof Error ? error.message : 'unknown error')}`,
    );
    process.exitCode = 1;
  });
}
