/**
 * The retry runner (scripts/reconcile-deliveries.mjs), driven off an in-memory
 * PostgREST double. It is a zero-dependency .mjs run by
 * .github/workflows/cron-reconcile-deliveries.yml without `npm ci`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/portal/proposalPdf', () => ({ archiveSignedProposal: vi.fn() }));
vi.mock('@/lib/email/sendEmail', () => ({ sendEmail: vi.fn() }));

import { sendEmail } from '@/lib/email/sendEmail';
import { archiveSignedProposal } from '@/lib/portal/proposalPdf';
import { processProposalFulfilment } from '@/lib/portal/fulfilment';
import {
  FUNNEL_SOURCES,
  Postgrest,
  buildDeliveryMessage,
  reconcileFulfilmentOne,
  reconcileOne,
  runOnce,
  toResendPayload,
} from '../../scripts/reconcile-deliveries.mjs';

const PROPOSAL_ID = '11111111-1111-4111-8111-111111111111';
const DELIVERY_ID = '22222222-2222-4222-8222-222222222222';
const CLIENT_EMAIL = 'Pat@Example.com';

// As PostgREST returns it: timestamptz with an explicit offset.
const proposalRow = {
  id: PROPOSAL_ID,
  token: 'proposal-token',
  ref_number: 'FT-2026-10-0001',
  first_name: 'Pat',
  last_name: 'Patterson',
  business_name: 'Pat Trading Co',
  email: CLIENT_EMAIL,
  status: 'signed',
  signed_at: '2026-10-07T08:00:00+00:00',
  proposal_pdf_drive_id: 'drive_1',
};

type Row = Record<string, unknown>;

function fakeDb(overrides: Partial<Record<string, unknown>> = {}) {
  const calls: { kind: string; args: unknown[] }[] = [];
  const db = {
    calls,
    claims: [] as Row[],
    one: vi.fn(async (table: string, _id: string, _select?: string, idColumn?: string) => {
      calls.push({ kind: 'one', args: [table, idColumn] });
      if (table === 'proposals') return proposalRow;
      if (table === 'proposal_fulfilment')
        return { client_email_delivery_id: null, owner_email_delivery_id: null };
      throw new Error(`unexpected one(${table})`);
    }),
    maybeOne: vi.fn(async () => null),
    rpc: vi.fn(async (name: string, body: Row) => {
      calls.push({ kind: 'rpc', args: [name, body] });
      if (name === 'claim_proposal_fulfilment_stage') {
        const next = db.claims.shift();
        return next ? [{ proposal_id: PROPOSAL_ID, attempt_count: 1, ...next }] : [];
      }
      return true;
    }),
    request: vi.fn(async (table: string, opts: Row = {}) => {
      calls.push({ kind: 'request', args: [table, opts] });
      if (table === 'email_deliveries' && opts.method === 'POST') {
        return [{ id: DELIVERY_ID, status: 'pending', next_attempt_at: new Date().toISOString(), ...(opts.body as Row) }];
      }
      return [];
    }),
    deliveries: vi.fn(async (params: Row) => {
      calls.push({ kind: 'deliveries', args: [params] });
      return [];
    }),
    patchDelivery: vi.fn(async (row: Row, values: Row) => [{ ...row, ...values }]),
    finishDelivery: vi.fn(async () => [{ id: DELIVERY_ID }]),
    deliveryStatusAt: vi.fn(async () => 'accepted'),
    ...overrides,
  };
  return db;
}

const config = {
  serviceKey: 'service-key-for-tests',
  resendApiKey: 're_test',
  marketingUrl: 'https://capucor.com',
  ownerEmail: 'zjak@capucor.com',
};

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'email_1' }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the "signed" emails: first attempt and retry send the same request', () => {
  it('rebuilds byte-for-byte what the Worker sent, under the same key', async () => {
    // The Worker's first attempt, captured at sendEmail.
    process.env.OWNER_NOTIFICATION_EMAIL = 'zjak@capucor.com';
    vi.mocked(archiveSignedProposal).mockResolvedValue({ ok: true, fileId: 'drive_1' });
    vi.mocked(sendEmail).mockResolvedValue({
      deliveryStatus: 'accepted',
      deliveryId: DELIVERY_ID,
      providerId: 'email_1',
      errorCode: null,
      errorMessage: null,
    });
    const stages = ['pdf', 'client_email', 'owner_email'];
    const admin = {
      rpc: vi.fn(async (name: string) =>
        name === 'claim_proposal_fulfilment_stage'
          ? { data: stages.length ? [{ stage: stages.shift(), attempt_count: 1 }] : [], error: null }
          : { data: true, error: null },
      ),
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        update: () => ({ eq: () => ({ is: async () => ({ error: null }) }) }),
      }),
    } as unknown as SupabaseClient<Database>;
    await processProposalFulfilment(
      admin,
      {
        id: PROPOSAL_ID,
        token: proposalRow.token,
        ref_number: proposalRow.ref_number,
        email: CLIENT_EMAIL,
        first_name: 'Pat',
        last_name: 'Patterson',
        business_name: 'Pat Trading Co',
      },
      '2026-10-07T08:00:00.000Z',
    );
    const [workerClient, workerOwner] = vi.mocked(sendEmail).mock.calls.map((c) => c[0]);

    // The runner's rebuild from the stored rows.
    const db = fakeDb();
    const runnerClient = await buildDeliveryMessage(
      { source_type: 'proposal', source_id: PROPOSAL_ID, event_type: 'proposal.signed_client', recipient: 'pat@example.com' },
      db,
    );
    const runnerOwner = await buildDeliveryMessage(
      { source_type: 'proposal', source_id: PROPOSAL_ID, event_type: 'proposal.signed_owner', recipient: 'zjak@capucor.com' },
      db,
    );

    expect(runnerClient).toEqual(workerClient.message);
    expect(runnerOwner).toEqual(workerOwner.message);
    expect((runnerOwner as { html: string }).html).toContain('https://drive.google.com/file/d/drive_1/view');
    expect(toResendPayload(runnerClient).reply_to).toBe('info@capucor.com');
  });

  it('finishes a pre-phase-3 portal_ready_client send as the same "signed" email', async () => {
    const db = fakeDb();
    const legacy = await buildDeliveryMessage(
      { source_type: 'proposal', source_id: PROPOSAL_ID, event_type: 'proposal.portal_ready_client', recipient: 'pat@example.com' },
      db,
    );
    const current = await buildDeliveryMessage(
      { source_type: 'proposal', source_id: PROPOSAL_ID, event_type: 'proposal.signed_client', recipient: 'pat@example.com' },
      db,
    );
    expect(legacy).toEqual(current);
  });

  it('refuses a retired provisioning event permanently', async () => {
    await expect(
      buildDeliveryMessage(
        { source_type: 'proposal', source_id: PROPOSAL_ID, event_type: 'proposal.provision_failed_owner', recipient: 'zjak@capucor.com' },
        fakeDb(),
      ),
    ).rejects.toMatchObject({ code: 'unsupported_event' });
  });

  it("never rebuilds capucor-os's own email sources", async () => {
    expect(FUNNEL_SOURCES).toEqual(['lead', 'data_request', 'proposal']);
    await expect(
      buildDeliveryMessage({ source_type: 'request_email', source_id: PROPOSAL_ID, event_type: 'request.monthly_close_sent', recipient: 'x@y.z' }, fakeDb()),
    ).rejects.toMatchObject({ code: 'unsupported_source' });
  });
});

describe('fulfilment stages', () => {
  it('archives through the Worker bridge with a body-bound HMAC', async () => {
    const db = fakeDb({
      one: vi.fn(async () => ({ ...proposalRow, proposal_pdf_drive_id: null })),
    });
    db.claims.push({ stage: 'pdf' });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, fileId: 'drive_9' }), { status: 200 }));

    const outcomes = await reconcileFulfilmentOne(db, PROPOSAL_ID, config);

    expect(outcomes).toEqual(['pdf_complete']);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://capucor.com/api/internal/proposal-fulfilment/pdf');
    expect(init.headers['x-capucor-signature']).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.parse(init.body)).toEqual({ proposalId: PROPOSAL_ID });
  });

  it('creates the client delivery under the phase-3 event and key', async () => {
    const db = fakeDb();
    db.claims.push({ stage: 'client_email' });

    const outcomes = await reconcileFulfilmentOne(db, PROPOSAL_ID, config);

    expect(outcomes).toEqual(['client_email_pending']);
    const insert = db.calls.find((c) => c.kind === 'request' && (c.args[1] as Row).method === 'POST');
    expect((insert!.args[1] as Row).body).toMatchObject({
      source_type: 'proposal',
      event_type: 'proposal.signed_client',
      idempotency_key: `capucor_web_proposal_signed_client_${PROPOSAL_ID}`,
      recipient: 'pat@example.com',
    });
  });

  it('does not act on a stage it does not know', async () => {
    const db = fakeDb();
    db.claims.push({ stage: 'portal' });
    const outcomes = await reconcileFulfilmentOne(db, PROPOSAL_ID, config);
    expect(outcomes).toEqual(['portal_retry_scheduled']);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('email retries', () => {
  const due = {
    id: DELIVERY_ID,
    source_type: 'proposal',
    source_id: PROPOSAL_ID,
    event_type: 'proposal.signed_client',
    recipient: 'pat@example.com',
    idempotency_key: `capucor_web_proposal_signed_client_${PROPOSAL_ID}`,
    status: 'retry_scheduled',
    attempt_count: 1,
    created_at: new Date().toISOString(),
    last_error_code: 'rate_limit_exceeded',
  };

  it('resends under the original key, stamps the signed email and syncs fulfilment', async () => {
    const db = fakeDb();
    const outcome = await reconcileOne(db, due, config, new Date().toISOString());

    expect(outcome).toBe('accepted');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['Idempotency-Key']).toBe(due.idempotency_key);
    expect(JSON.parse(init.body)).toMatchObject({ to: CLIENT_EMAIL, subject: 'Your Capucor proposal is signed' });
    expect(db.calls.some((c) => c.kind === 'request' && c.args[0] === 'proposals')).toBe(true);
    expect(db.rpc).toHaveBeenCalledWith('sync_proposal_fulfilment_email', { p_delivery_id: DELIVERY_ID });
  });

  it('fails the sixth attempt permanently without calling the provider', async () => {
    const db = fakeDb();
    const outcome = await reconcileOne(db, { ...due, attempt_count: 6 }, config, new Date().toISOString());
    expect(outcome).toBe('permanently_failed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('queries only funnel sources, and fails a run only for what that run failed', async () => {
    const db = fakeDb();
    const lines: string[] = [];
    const run = await runOnce(db, config, (l: string) => lines.push(l));
    const deliveryQueries = db.calls.filter((c) => c.kind === 'deliveries');
    expect(deliveryQueries).toHaveLength(2);
    for (const q of deliveryQueries) {
      expect((q.args[0] as Row).source_type).toBe('in.(lead,data_request,proposal)');
    }
    expect(run.newPermanent).toBe(0);
    expect(lines).toEqual([]);
  });

  it('logs ids and outcomes, never a recipient', async () => {
    const db = fakeDb({
      deliveries: vi.fn(async (params: Row) => (params.status === 'eq.processing' ? [] : [due])),
    });
    const lines: string[] = [];
    await runOnce(db, config, (l: string) => lines.push(l));
    expect(lines).toEqual([`delivery=${DELIVERY_ID} event=proposal.signed_client outcome=accepted`]);
    expect(lines.join('\n')).not.toMatch(/@/);
  });
});

describe('PostgREST errors', () => {
  it('carry the status and code, never the response detail', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ code: '23514', message: 'violates check', details: 'Failing row contains (pat@example.com)' }),
        { status: 400 },
      ),
    );
    const db = new Postgrest('https://example.supabase.co', 'key');
    await expect(db.request('email_deliveries')).rejects.toThrow('PostgREST GET email_deliveries failed (400 23514).');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).not.toHaveProperty('Authorization');
  });
});
