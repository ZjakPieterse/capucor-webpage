import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

import { sendEmail } from '@/lib/email/sendEmail';

const message = {
  from: 'Capucor <hello@capucor.com>',
  to: 'pat@example.com',
  subject: 'Test message',
  text: 'Hello',
};
const idempotencyKey = 'capucor_test_event_123';
const eventType = 'test.event';

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  process.env.RESEND_API_KEY = 're_test';
});

describe('sendEmail', () => {
  it('returns accepted with the provider message ID and passes the stable key', async () => {
    sendMock.mockResolvedValue({
      data: { id: 'email_123' },
      error: null,
      headers: null,
    });

    await expect(sendEmail({ eventType, message, idempotencyKey })).resolves.toEqual({
      deliveryStatus: 'accepted',
      providerId: 'email_123',
      errorCode: null,
      errorMessage: null,
    });
    expect(sendMock).toHaveBeenCalledWith(message, { idempotencyKey });
  });

  it('converts a returned provider error into pending', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    sendMock.mockResolvedValue({
      data: null,
      error: {
        name: 'validation_error',
        message: 'Invalid recipient',
        statusCode: 422,
      },
      headers: null,
    });

    await expect(sendEmail({ eventType, message, idempotencyKey })).resolves.toMatchObject({
      deliveryStatus: 'pending',
      providerId: null,
      errorCode: 'validation_error',
      errorMessage: 'Invalid recipient',
    });
    expect(errorSpy).toHaveBeenCalledWith(
      '[EMAIL] delivery pending:',
      expect.objectContaining({ eventType, errorCode: 'validation_error' }),
    );
    errorSpy.mockRestore();
  });

  it('converts a thrown transport error into pending', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    sendMock.mockRejectedValue(new Error('network unavailable'));

    await expect(sendEmail({ eventType, message, idempotencyKey })).resolves.toMatchObject({
      deliveryStatus: 'pending',
      errorCode: 'transport_error',
      errorMessage: 'network unavailable',
    });
    errorSpy.mockRestore();
  });

  it('times out a provider call without throwing', async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    sendMock.mockImplementation(() => new Promise(() => {}));

    const resultPromise = sendEmail({
      eventType,
      message,
      idempotencyKey,
      timeoutMs: 50,
    });
    await vi.advanceTimersByTimeAsync(50);

    await expect(resultPromise).resolves.toMatchObject({
      deliveryStatus: 'pending',
      errorCode: 'timeout',
    });
    errorSpy.mockRestore();
  });

  it('returns pending without constructing a provider request when the key is absent', async () => {
    delete process.env.RESEND_API_KEY;

    await expect(sendEmail({ eventType, message, idempotencyKey })).resolves.toMatchObject({
      deliveryStatus: 'pending',
      errorCode: 'missing_api_key',
    });
    expect(sendMock).not.toHaveBeenCalled();
  });
});
