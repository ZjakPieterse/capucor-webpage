import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { Resend, type CreateEmailOptions } from 'resend';
import type { Database } from '@/types/db';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const DEFAULT_TIMEOUT_MS = 8_000;
const LEASE_MS = 60_000;
const FIRST_RETRY_MS = 10 * 60_000;
const MAX_RETRY_MS = 6 * 60 * 60_000;
const MAX_IDEMPOTENCY_KEY_LENGTH = 256;
const MAX_ERROR_LENGTH = 2_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

export type DeliveryStatus = 'accepted' | 'pending';
export type EmailSourceType = 'lead' | 'data_request' | 'proposal';

export type EmailDeliveryResult =
  | {
      deliveryStatus: 'accepted';
      deliveryId: string;
      providerId: string;
      errorCode: null;
      errorMessage: null;
    }
  | {
      deliveryStatus: 'pending';
      deliveryId: string | null;
      providerId: null;
      errorCode: string;
      errorMessage: string;
    };

interface SendEmailInput {
  sourceType: EmailSourceType;
  sourceId: string;
  eventType: string;
  message: CreateEmailOptions;
  idempotencyKey: string;
  timeoutMs?: number;
  adminClient?: SupabaseClient<Database>;
}

type DeliveryRow = Database['public']['Tables']['email_deliveries']['Row'];

type ProviderResult =
  | {
      deliveryStatus: 'accepted';
      providerId: string;
      errorCode: null;
      errorMessage: null;
    }
  | {
      deliveryStatus: 'pending';
      providerId: null;
      errorCode: string;
      errorMessage: string;
    };

class EmailTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Email provider did not respond within ${timeoutMs}ms.`);
    this.name = 'EmailTimeoutError';
  }
}

function truncate(value: string): string {
  return value.slice(0, MAX_ERROR_LENGTH);
}

function providerPending(
  eventType: string,
  errorCode: string,
  errorMessage: string,
  log = true,
): ProviderResult {
  const safeCode = truncate(errorCode);
  const safeMessage = truncate(errorMessage);
  if (log) {
    console.error('[EMAIL] delivery pending:', {
      eventType,
      errorCode: safeCode,
      errorMessage: safeMessage,
    });
  }

  return {
    deliveryStatus: 'pending',
    providerId: null,
    errorCode: safeCode,
    errorMessage: safeMessage,
  };
}

function durablePending(
  deliveryId: string | null,
  errorCode: string,
  errorMessage: string,
): EmailDeliveryResult {
  return {
    deliveryStatus: 'pending',
    deliveryId,
    providerId: null,
    errorCode: truncate(errorCode),
    errorMessage: truncate(errorMessage),
  };
}

function recipientFor(message: CreateEmailOptions): string | null {
  const recipients = Array.isArray(message.to) ? message.to : [message.to];
  if (recipients.length !== 1 || typeof recipients[0] !== 'string') return null;
  const recipient = recipients[0].trim().toLowerCase();
  return recipient.length >= 3 && recipient.length <= 320 ? recipient : null;
}

function retryAt(attemptCount: number): string {
  const delay = Math.min(FIRST_RETRY_MS * 2 ** Math.max(0, attemptCount - 1), MAX_RETRY_MS);
  return new Date(Date.now() + delay).toISOString();
}

function sameBusinessEvent(
  row: DeliveryRow,
  input: Pick<SendEmailInput, 'sourceType' | 'sourceId' | 'eventType'>,
  recipient: string,
): boolean {
  return (
    row.source_type === input.sourceType &&
    row.source_id === input.sourceId &&
    row.event_type === input.eventType &&
    row.recipient === recipient
  );
}

async function loadExisting(
  admin: SupabaseClient<Database>,
  idempotencyKey: string,
): Promise<{ row: DeliveryRow | null; errorCode: string | null }> {
  const { data, error } = await admin
    .from('email_deliveries')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (error) {
    console.error('[EMAIL] delivery lookup failed:', { errorCode: error.code });
    return { row: null, errorCode: error.code ?? 'delivery_lookup_failed' };
  }
  return { row: data, errorCode: null };
}

function resultForExisting(row: DeliveryRow): EmailDeliveryResult {
  if (row.status === 'accepted' && row.provider_id) {
    return {
      deliveryStatus: 'accepted',
      deliveryId: row.id,
      providerId: row.provider_id,
      errorCode: null,
      errorMessage: null,
    };
  }

  if (row.status === 'permanently_failed') {
    return durablePending(
      row.id,
      row.last_error_code ?? 'permanently_failed',
      row.last_error_message ?? 'Email delivery has permanently failed.',
    );
  }

  if (row.status === 'processing') {
    return durablePending(row.id, 'delivery_in_progress', 'Email delivery is already in progress.');
  }

  return durablePending(
    row.id,
    row.last_error_code ?? 'retry_scheduled',
    row.last_error_message ?? 'Email delivery is waiting for its next attempt.',
  );
}

async function submitToProvider(
  message: CreateEmailOptions,
  eventType: string,
  idempotencyKey: string,
  timeoutMs: number,
): Promise<ProviderResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return providerPending(eventType, 'missing_api_key', 'RESEND_API_KEY is not configured.', false);
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    const resend = new Resend(apiKey);
    const response = await Promise.race([
      resend.emails.send(message, { idempotencyKey }),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new EmailTimeoutError(timeoutMs)), timeoutMs);
      }),
    ]);

    if (response.error) {
      return providerPending(eventType, response.error.name, response.error.message);
    }
    if (!response.data?.id) {
      return providerPending(
        eventType,
        'invalid_provider_response',
        'Email provider accepted the request without returning a message ID.',
      );
    }

    return {
      deliveryStatus: 'accepted',
      providerId: response.data.id,
      errorCode: null,
      errorMessage: null,
    };
  } catch (error) {
    if (error instanceof EmailTimeoutError) {
      return providerPending(eventType, 'timeout', error.message);
    }
    return providerPending(
      eventType,
      'transport_error',
      error instanceof Error ? error.message : 'Unknown email transport error.',
    );
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

async function finishAttempt(
  admin: SupabaseClient<Database>,
  row: DeliveryRow,
  leaseToken: string,
  provider: ProviderResult,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const values =
    provider.deliveryStatus === 'accepted'
      ? {
          status: 'accepted',
          provider_id: provider.providerId,
          accepted_at: nowIso,
          failed_at: null,
          last_error_code: null,
          last_error_message: null,
          lease_token: null,
          lease_expires_at: null,
        }
      : {
          status: 'retry_scheduled',
          provider_id: null,
          accepted_at: null,
          failed_at: null,
          last_error_code: provider.errorCode,
          last_error_message: provider.errorMessage,
          next_attempt_at: retryAt(row.attempt_count),
          lease_token: null,
          lease_expires_at: null,
        };

  const { data, error } = await admin
    .from('email_deliveries')
    .update(values)
    .eq('id', row.id)
    .eq('status', 'processing')
    .eq('lease_token', leaseToken)
    .select('id')
    .maybeSingle();

  if (error || !data) {
    console.error('[EMAIL] delivery completion persistence failed:', {
      eventType: row.event_type,
      errorCode: error?.code ?? 'lease_lost',
    });
  }
}

/**
 * Persist, claim and immediately attempt one transactional email.
 *
 * The database row is created before Resend is called. A globally unique
 * idempotency key and a conditional lease ensure concurrent/repeated requests
 * create one provider attempt. Message content is never stored; retry workers
 * reconstruct it from source_type + source_id + event_type.
 */
async function sendDurableEmail({
  sourceType,
  sourceId,
  message,
  eventType,
  idempotencyKey,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  adminClient,
}: SendEmailInput): Promise<EmailDeliveryResult> {
  const recipient = recipientFor(message);
  if (
    !recipient ||
    !UUID_PATTERN.test(sourceId) ||
    !EVENT_PATTERN.test(eventType) ||
    !idempotencyKey ||
    idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH ||
    timeoutMs <= 0
  ) {
    return durablePending(null, 'invalid_adapter_input', 'Durable email input or timeout is invalid.');
  }

  const admin = adminClient ?? createSupabaseAdminClient();
  const leaseToken = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const initialId = crypto.randomUUID();

  const { data: inserted, error: insertError } = await admin
    .from('email_deliveries')
    .insert({
      id: initialId,
      source_type: sourceType,
      source_id: sourceId,
      event_type: eventType,
      recipient,
      idempotency_key: idempotencyKey,
      status: 'processing',
      attempt_count: 1,
      next_attempt_at: nowIso,
      last_attempt_at: nowIso,
      lease_token: leaseToken,
      lease_expires_at: new Date(Date.now() + LEASE_MS).toISOString(),
    })
    .select('*')
    .single();

  let claimed = inserted;
  if (insertError) {
    if (insertError.code !== '23505') {
      console.error('[EMAIL] delivery persistence failed:', {
        eventType,
        errorCode: insertError.code,
      });
      return durablePending(
        null,
        insertError.code ?? 'delivery_persistence_failed',
        'Email delivery could not be persisted.',
      );
    }

    const existing = await loadExisting(admin, idempotencyKey);
    if (!existing.row) {
      return durablePending(
        null,
        existing.errorCode ?? 'delivery_lookup_failed',
        'Existing email delivery could not be loaded.',
      );
    }
    if (!sameBusinessEvent(existing.row, { sourceType, sourceId, eventType }, recipient)) {
      return durablePending(
        existing.row.id,
        'idempotency_conflict',
        'The email idempotency key belongs to a different business event.',
      );
    }

    if (existing.row.status === 'accepted') {
      return resultForExisting(existing.row);
    }
    if (existing.row.status === 'permanently_failed') {
      return resultForExisting(existing.row);
    }
    const staleProcessing =
      existing.row.status === 'processing' &&
      !!existing.row.lease_expires_at &&
      new Date(existing.row.lease_expires_at).getTime() <= Date.now();
    if (existing.row.status === 'processing' && !staleProcessing) {
      return resultForExisting(existing.row);
    }
    if (!staleProcessing && new Date(existing.row.next_attempt_at).getTime() > Date.now()) {
      return resultForExisting(existing.row);
    }

    const claimTime = new Date().toISOString();
    let claim = admin
      .from('email_deliveries')
      .update({
        status: 'processing',
        attempt_count: existing.row.attempt_count + 1,
        last_attempt_at: claimTime,
        lease_token: leaseToken,
        lease_expires_at: new Date(Date.now() + LEASE_MS).toISOString(),
      })
      .eq('id', existing.row.id)
      .eq('attempt_count', existing.row.attempt_count);

    claim = staleProcessing
      ? claim.eq('status', 'processing').lte('lease_expires_at', claimTime)
      : claim.in('status', ['pending', 'retry_scheduled']).lte('next_attempt_at', claimTime);

    const { data: reclaimed, error: claimError } = await claim.select('*').maybeSingle();

    if (claimError) {
      console.error('[EMAIL] delivery claim failed:', { eventType, errorCode: claimError.code });
      return durablePending(
        existing.row.id,
        claimError.code ?? 'delivery_claim_failed',
        'Email delivery could not be claimed.',
      );
    }
    if (!reclaimed) {
      const winner = await loadExisting(admin, idempotencyKey);
      return winner.row
        ? resultForExisting(winner.row)
        : durablePending(existing.row.id, 'delivery_in_progress', 'Another request claimed the email delivery.');
    }
    claimed = reclaimed;
  }

  if (!claimed) {
    return durablePending(null, 'delivery_persistence_failed', 'Email delivery could not be persisted.');
  }

  const provider = await submitToProvider(message, eventType, idempotencyKey, timeoutMs);
  await finishAttempt(admin, claimed, leaseToken, provider);

  return provider.deliveryStatus === 'accepted'
    ? {
        deliveryStatus: 'accepted',
        deliveryId: claimed.id,
        providerId: provider.providerId,
        errorCode: null,
        errorMessage: null,
      }
    : {
        deliveryStatus: 'pending',
        deliveryId: claimed.id,
        providerId: null,
        errorCode: provider.errorCode,
        errorMessage: provider.errorMessage,
      };
}

export async function sendEmail(input: SendEmailInput): Promise<EmailDeliveryResult> {
  try {
    return await sendDurableEmail(input);
  } catch {
    console.error('[EMAIL] unexpected durable adapter failure:', {
      eventType: input.eventType,
      errorCode: 'adapter_failure',
    });
    return durablePending(null, 'adapter_failure', 'Email delivery could not be queued.');
  }
}
