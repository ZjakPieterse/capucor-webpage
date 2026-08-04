import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

import { sendEmail } from '@/lib/email/sendEmail';
import type { Database } from '@/types/db';

type DeliveryRow = Database['public']['Tables']['email_deliveries']['Row'];
type Condition =
  | { kind: 'eq'; column: keyof DeliveryRow; value: unknown }
  | { kind: 'in'; column: keyof DeliveryRow; value: unknown[] }
  | { kind: 'lte'; column: keyof DeliveryRow; value: string };

const SOURCE_ID = '11111111-1111-4111-8111-111111111111';
const message = {
  from: 'Capucor <hello@capucor.com>',
  to: 'pat@example.com',
  subject: 'Test message',
  text: 'Hello',
};
const idempotencyKey = 'capucor_test_event_123';
const eventType = 'test.event';

function createFakeAdmin() {
  const rows: DeliveryRow[] = [];
  let insertError: { code: string } | null = null;

  function matches(row: DeliveryRow, conditions: Condition[]): boolean {
    return conditions.every((condition) => {
      const value = row[condition.column];
      if (condition.kind === 'eq') return value === condition.value;
      if (condition.kind === 'in') return condition.value.includes(value);
      return typeof value === 'string' && value <= condition.value;
    });
  }

  function builder(mode: 'select' | 'insert' | 'update', payload?: Record<string, unknown>) {
    const conditions: Condition[] = [];
    const query = {
      eq(column: keyof DeliveryRow, value: unknown) {
        conditions.push({ kind: 'eq', column, value });
        return query;
      },
      in(column: keyof DeliveryRow, value: unknown[]) {
        conditions.push({ kind: 'in', column, value });
        return query;
      },
      lte(column: keyof DeliveryRow, value: string) {
        conditions.push({ kind: 'lte', column, value });
        return query;
      },
      select() {
        return query;
      },
      async single() {
        return execute();
      },
      async maybeSingle() {
        return execute();
      },
    };

    function execute(): { data: DeliveryRow | null; error: { code: string } | null } {
      if (mode === 'insert') {
        if (insertError) return { data: null, error: insertError };
        if (rows.some((row) => row.idempotency_key === payload!.idempotency_key)) {
          return { data: null, error: { code: '23505' } };
        }
        const now = new Date().toISOString();
        const row = {
          accepted_at: null,
          attempt_count: 0,
          created_at: now,
          event_type: '',
          failed_at: null,
          id: '',
          idempotency_key: '',
          last_attempt_at: null,
          last_error_code: null,
          last_error_message: null,
          lease_expires_at: null,
          lease_token: null,
          next_attempt_at: now,
          provider_id: null,
          recipient: '',
          source_id: '',
          source_type: '',
          status: 'pending',
          updated_at: now,
          ...payload,
        } as DeliveryRow;
        rows.push(row);
        return { data: row, error: null };
      }

      const row = rows.find((candidate) => matches(candidate, conditions)) ?? null;
      if (mode === 'update' && row) {
        Object.assign(row, payload, { updated_at: new Date().toISOString() });
      }
      return { data: row, error: null };
    }

    return query;
  }

  const admin = {
    from(table: string) {
      if (table !== 'email_deliveries') throw new Error(`Unexpected table ${table}`);
      return {
        insert: (payload: Record<string, unknown>) => builder('insert', payload),
        select: () => builder('select'),
        update: (payload: Record<string, unknown>) => builder('update', payload),
      };
    },
  };

  return {
    admin: admin as never,
    rows,
    failInserts(code: string) {
      insertError = { code };
    },
  };
}

function input(admin: never) {
  return {
    sourceType: 'lead' as const,
    sourceId: SOURCE_ID,
    eventType,
    message,
    idempotencyKey,
    adminClient: admin,
  };
}

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  process.env.RESEND_API_KEY = 're_test';
});

describe('sendEmail durable adapter', () => {
  it('persists the event, returns accepted and records the provider ID', async () => {
    const store = createFakeAdmin();
    sendMock.mockResolvedValue({ data: { id: 'email_123' }, error: null, headers: null });

    await expect(sendEmail(input(store.admin))).resolves.toMatchObject({
      deliveryStatus: 'accepted',
      deliveryId: expect.any(String),
      providerId: 'email_123',
      errorCode: null,
    });

    expect(sendMock).toHaveBeenCalledWith(message, { idempotencyKey });
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]).toMatchObject({
      source_type: 'lead',
      source_id: SOURCE_ID,
      event_type: eventType,
      recipient: 'pat@example.com',
      idempotency_key: idempotencyKey,
      status: 'accepted',
      attempt_count: 1,
      provider_id: 'email_123',
      lease_token: null,
    });
    expect(store.rows[0]!.accepted_at).toEqual(expect.any(String));
    expect(JSON.stringify(store.rows[0])).not.toContain(message.text);
  });

  it('turns a returned provider error into durable retry work without a sent timestamp', async () => {
    const store = createFakeAdmin();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    sendMock.mockResolvedValue({
      data: null,
      error: { name: 'validation_error', message: 'Invalid recipient', statusCode: 422 },
      headers: null,
    });

    await expect(sendEmail(input(store.admin))).resolves.toMatchObject({
      deliveryStatus: 'pending',
      errorCode: 'validation_error',
      errorMessage: 'Invalid recipient',
    });
    expect(store.rows[0]).toMatchObject({
      status: 'retry_scheduled',
      provider_id: null,
      accepted_at: null,
      last_error_code: 'validation_error',
      lease_token: null,
    });
    expect(new Date(store.rows[0]!.next_attempt_at).getTime()).toBeGreaterThan(Date.now());
    errorSpy.mockRestore();
  });

  it('converts thrown transport failures and timeouts into durable retry work', async () => {
    const thrownStore = createFakeAdmin();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    sendMock.mockRejectedValueOnce(new Error('network unavailable'));
    await expect(sendEmail(input(thrownStore.admin))).resolves.toMatchObject({
      deliveryStatus: 'pending',
      errorCode: 'transport_error',
    });
    expect(thrownStore.rows[0]!.status).toBe('retry_scheduled');

    vi.useFakeTimers();
    const timeoutStore = createFakeAdmin();
    sendMock.mockImplementationOnce(() => new Promise(() => {}));
    const result = sendEmail({ ...input(timeoutStore.admin), timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(50);
    await expect(result).resolves.toMatchObject({ deliveryStatus: 'pending', errorCode: 'timeout' });
    expect(timeoutStore.rows[0]!.status).toBe('retry_scheduled');
    errorSpy.mockRestore();
  });

  it('persists missing-provider configuration as retry work without calling Resend', async () => {
    const store = createFakeAdmin();
    delete process.env.RESEND_API_KEY;

    await expect(sendEmail(input(store.admin))).resolves.toMatchObject({
      deliveryStatus: 'pending',
      errorCode: 'missing_api_key',
    });
    expect(sendMock).not.toHaveBeenCalled();
    expect(store.rows[0]).toMatchObject({ status: 'retry_scheduled', accepted_at: null });
  });

  it('reuses an accepted event without another provider request', async () => {
    const store = createFakeAdmin();
    sendMock.mockResolvedValue({ data: { id: 'email_123' }, error: null, headers: null });

    const first = await sendEmail(input(store.admin));
    const second = await sendEmail(input(store.admin));

    expect(second).toEqual(first);
    expect(store.rows).toHaveLength(1);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('allows only one provider request while concurrent calls share an event', async () => {
    const store = createFakeAdmin();
    let releaseProvider!: (value: { data: { id: string }; error: null; headers: null }) => void;
    sendMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseProvider = resolve;
        }),
    );

    const first = sendEmail(input(store.admin));
    await vi.waitFor(() => expect(store.rows[0]!.status).toBe('processing'));
    const second = await sendEmail(input(store.admin));

    expect(second).toMatchObject({ deliveryStatus: 'pending', errorCode: 'delivery_in_progress' });
    expect(sendMock).toHaveBeenCalledTimes(1);
    releaseProvider({ data: { id: 'email_concurrent' }, error: null, headers: null });
    await expect(first).resolves.toMatchObject({
      deliveryStatus: 'accepted',
      providerId: 'email_concurrent',
    });
    expect(store.rows).toHaveLength(1);
  });

  it('does not retry a scheduled event before it is due', async () => {
    const store = createFakeAdmin();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { name: 'rate_limit_exceeded', message: 'Slow down', statusCode: 429 },
      headers: null,
    });
    await sendEmail(input(store.admin));
    sendMock.mockClear();

    await expect(sendEmail(input(store.admin))).resolves.toMatchObject({
      deliveryStatus: 'pending',
      errorCode: 'rate_limit_exceeded',
    });
    expect(sendMock).not.toHaveBeenCalled();
    expect(store.rows[0]!.attempt_count).toBe(1);
    errorSpy.mockRestore();
  });

  it('claims a due retry once and can reach accepted', async () => {
    const store = createFakeAdmin();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { name: 'temporary_failure', message: 'Try later', statusCode: 503 },
      headers: null,
    });
    await sendEmail(input(store.admin));
    store.rows[0]!.next_attempt_at = new Date(Date.now() - 1_000).toISOString();
    sendMock.mockResolvedValueOnce({ data: { id: 'email_retry' }, error: null, headers: null });

    await expect(sendEmail(input(store.admin))).resolves.toMatchObject({
      deliveryStatus: 'accepted',
      providerId: 'email_retry',
    });
    expect(store.rows[0]).toMatchObject({ status: 'accepted', attempt_count: 2, provider_id: 'email_retry' });
    expect(sendMock).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
  });

  it('reclaims an expired processing lease with the same provider idempotency key', async () => {
    const store = createFakeAdmin();
    sendMock.mockResolvedValueOnce({ data: { id: 'email_first' }, error: null, headers: null });
    await sendEmail(input(store.admin));
    Object.assign(store.rows[0]!, {
      status: 'processing',
      provider_id: null,
      accepted_at: null,
      lease_token: 'stale-lease',
      lease_expires_at: new Date(Date.now() - 1_000).toISOString(),
    });
    sendMock.mockResolvedValueOnce({ data: { id: 'email_first' }, error: null, headers: null });

    await expect(sendEmail(input(store.admin))).resolves.toMatchObject({
      deliveryStatus: 'accepted',
      providerId: 'email_first',
    });
    expect(store.rows[0]).toMatchObject({ status: 'accepted', attempt_count: 2 });
    expect(sendMock.mock.calls[1]![1]).toEqual({ idempotencyKey });
  });

  it('does not call the provider when persistence fails or an event key conflicts', async () => {
    const failedStore = createFakeAdmin();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    failedStore.failInserts('42501');
    await expect(sendEmail(input(failedStore.admin))).resolves.toMatchObject({
      deliveryStatus: 'pending',
      deliveryId: null,
      errorCode: '42501',
    });
    expect(sendMock).not.toHaveBeenCalled();

    const conflictStore = createFakeAdmin();
    sendMock.mockResolvedValueOnce({ data: { id: 'email_123' }, error: null, headers: null });
    await sendEmail(input(conflictStore.admin));
    sendMock.mockClear();
    await expect(
      sendEmail({ ...input(conflictStore.admin), sourceId: '22222222-2222-4222-8222-222222222222' }),
    ).resolves.toMatchObject({ deliveryStatus: 'pending', errorCode: 'idempotency_conflict' });
    expect(sendMock).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('contains an unexpected database exception as a pending outcome', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const throwingAdmin = {
      from() {
        throw new Error('database transport exploded');
      },
    } as never;

    await expect(sendEmail(input(throwingAdmin))).resolves.toMatchObject({
      deliveryStatus: 'pending',
      deliveryId: null,
      errorCode: 'adapter_failure',
    });
    expect(sendMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      '[EMAIL] unexpected durable adapter failure:',
      expect.objectContaining({ eventType, errorCode: 'adapter_failure' }),
    );
    errorSpy.mockRestore();
  });
});
