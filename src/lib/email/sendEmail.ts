import 'server-only';

import { Resend, type CreateEmailOptions } from 'resend';

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_IDEMPOTENCY_KEY_LENGTH = 256;

export type DeliveryStatus = 'accepted' | 'pending';

export type EmailDeliveryResult =
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

interface SendEmailInput {
  eventType: string;
  message: CreateEmailOptions;
  idempotencyKey: string;
  timeoutMs?: number;
}

class EmailTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Email provider did not respond within ${timeoutMs}ms.`);
    this.name = 'EmailTimeoutError';
  }
}

function pending(eventType: string, errorCode: string, errorMessage: string, log = true): EmailDeliveryResult {
  if (log) {
    console.error('[EMAIL] delivery pending:', {
      eventType,
      errorCode,
      errorMessage,
    });
  }

  return {
    deliveryStatus: 'pending',
    providerId: null,
    errorCode,
    errorMessage,
  };
}

/**
 * Submit one transactional email to Resend without treating a returned provider
 * error as success. The result never throws: callers can preserve an already-
 * committed business mutation and tell the truth about provider acceptance.
 *
 * The key must identify the business event, not the HTTP attempt. That lets a
 * later durable runner retry the same event without creating duplicate emails.
 */
export async function sendEmail({
  message,
  eventType,
  idempotencyKey,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: SendEmailInput): Promise<EmailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return pending(eventType, 'missing_api_key', 'RESEND_API_KEY is not configured.', false);
  }

  if (!idempotencyKey || idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH || timeoutMs <= 0) {
    return pending(eventType, 'invalid_adapter_input', 'Email idempotency key or timeout is invalid.');
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
      return pending(eventType, response.error.name, response.error.message);
    }

    if (!response.data?.id) {
      return pending(
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
      return pending(eventType, 'timeout', error.message);
    }

    return pending(
      eventType,
      'transport_error',
      error instanceof Error ? error.message : 'Unknown email transport error.',
    );
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}
