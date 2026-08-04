import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeJsonRequest } from './helpers/request';

// Step B of email-bound signing: POST /api/proposals/sign/confirm. Clicking the
// one-time link from the proposal's own inbox and confirming is what actually
// commits — promote the pending signature, flip to `signed`, provision, archive,
// and email. Provisioning/archival are mocked (their own suites cover them).

vi.mock('server-only', () => ({}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/portal/provision', () => ({
  provisionFromSignedProposal: vi.fn(),
}));
vi.mock('@/lib/portal/proposalPdf', () => ({
  archiveSignedProposal: vi.fn(),
}));

const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn() }));
vi.mock('@/lib/email/sendEmail', () => ({
  sendEmail: sendEmailMock,
}));

import { checkRateLimit } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { provisionFromSignedProposal } from '@/lib/portal/provision';
import { archiveSignedProposal } from '@/lib/portal/proposalPdf';
import { POST } from '@/app/api/proposals/sign/confirm/route';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const CFUTURE = new Date(Date.now() + 25 * 60 * 1000).toISOString();
const CPAST = new Date(Date.now() - 1000).toISOString();

let lookupResult: { data: Record<string, unknown> | null; error: unknown };
let updateResult: { error: unknown };
let updateRows: { id: string }[];
const updatePayloads: Record<string, unknown>[] = [];

function pendingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prop_1',
    token: 'a'.repeat(32),
    ref_number: 'FT-2026-06-0001',
    first_name: 'Pat',
    last_name: 'Patterson',
    business_name: 'Pat Trading Co',
    email: 'pat@example.com',
    status: 'viewed',
    expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    services: ['accounting'],
    brackets: { accounting: 0 },
    tier_slug: 'pro',
    addons: [],
    monthly_total_zar: 1325,
    vat_zar: 0,
    total_charge_zar: 1325,
    client_org_id: null,
    sign_confirm_expires_at: CFUTURE,
    pending_signature_name: 'Pat Patterson',
    pending_signature_method: 'typed',
    pending_signature_image: PNG,
    pending_signature_ip: '203.0.113.1',
    ...overrides,
  };
}

interface UpdateBuilder {
  eq: () => UpdateBuilder;
  in: () => UpdateBuilder;
  select: () => Promise<{ data: { id: string }[] | null; error: unknown }>;
  then: (onFulfilled: (v: { error: unknown }) => unknown, onRejected?: (e: unknown) => unknown) => Promise<unknown>;
}

const proposalUpdate = vi.fn((payload: Record<string, unknown>) => {
  updatePayloads.push(payload);
  const builder: UpdateBuilder = {
    eq: () => builder,
    in: () => builder,
    select: async () => ({
      data: updateResult.error ? null : updateRows,
      error: updateResult.error,
    }),
    then: (onFulfilled, onRejected) => Promise.resolve({ error: null }).then(onFulfilled, onRejected),
  };
  return builder;
});

function mountAdmin() {
  vi.mocked(createSupabaseAdminClient).mockReturnValue({
    from: (table: string) => {
      if (table !== 'proposals') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => lookupResult }),
        }),
        update: proposalUpdate,
      };
    },
  } as unknown as ReturnType<typeof createSupabaseAdminClient>);
}

const validBody = { ctoken: 'c'.repeat(40) };

beforeEach(() => {
  vi.clearAllMocks();
  updatePayloads.length = 0;
  lookupResult = { data: pendingRow(), error: null };
  updateResult = { error: null };
  updateRows = [{ id: 'prop_1' }];
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, retryAfter: 0 });
  sendEmailMock.mockResolvedValue({
    deliveryStatus: 'accepted',
    deliveryId: 'delivery_1',
    providerId: 'email_1',
    errorCode: null,
    errorMessage: null,
  });
  vi.mocked(provisionFromSignedProposal).mockResolvedValue({
    ok: true,
    orgId: 'org_1',
    userId: 'user_1',
    created: { org: true, membership: true, subscription: true },
  });
  vi.mocked(archiveSignedProposal).mockResolvedValue({
    ok: true,
    fileId: 'file_1',
    fileUrl: 'https://drive.google.com/file/d/file_1/view',
  });
  process.env.RESEND_API_KEY = 're_test';
  process.env.OWNER_NOTIFICATION_EMAIL = 'owner@capucor.com';
  mountAdmin();
});

describe('POST /api/proposals/sign/confirm (Step B — finalise)', () => {
  it('1. provisioned — commits the pending signature, provisions, emails portal-ready + owner', async () => {
    const res = await POST(makeJsonRequest('http://test/api/proposals/sign/confirm', validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      provisioned: true,
      deliveryStatus: 'accepted',
    });

    // Commit payload: pending promoted to real columns + cleared.
    const payload = updatePayloads[0]!;
    expect(payload).toMatchObject({
      status: 'signed',
      signature_name: 'Pat Patterson',
      signature_method: 'typed',
      signature_image: PNG,
      signature_ip: '203.0.113.1',
      pending_signature_name: null,
      sign_confirm_token: null,
    });
    expect(typeof payload.signed_at).toBe('string');

    expect(provisionFromSignedProposal).toHaveBeenCalledTimes(1);
    expect(vi.mocked(provisionFromSignedProposal).mock.calls[0]![1]).toMatchObject({
      id: 'prop_1',
      status: 'signed',
      tier_slug: 'pro',
    });
    expect(archiveSignedProposal).toHaveBeenCalledTimes(1);

    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    const clientInput = sendEmailMock.mock.calls[0]![0];
    const ownerInput = sendEmailMock.mock.calls[1]![0];
    expect(clientInput).toMatchObject({
      sourceType: 'proposal',
      sourceId: 'prop_1',
      eventType: 'proposal.portal_ready_client',
    });
    const clientEmail = clientInput.message;
    const ownerEmail = ownerInput.message;
    expect(clientEmail.subject).toMatch(/portal is ready/i);
    expect(clientEmail.html).toContain('/login?next=/portal');
    // Fraud-alert / signed-on line for the genuine recipient.
    expect(clientEmail.html).toMatch(/was signed on/i);
    expect(clientEmail.html).toMatch(/reply to this email right away/i);
    expect(ownerEmail.subject).toMatch(/set up billing/i);
    expect(ownerEmail.html).toContain('https://drive.google.com/file/d/file_1/view');
    expect(updatePayloads.some((item) => typeof item.signed_email_sent_at === 'string')).toBe(true);
  });

  it('2. provisioning failed — still 200, fallback client email + owner failure alert', async () => {
    vi.mocked(provisionFromSignedProposal).mockResolvedValueOnce({
      ok: false,
      error: 'auth user mint failed',
    });
    const res = await POST(makeJsonRequest('http://test/api/proposals/sign/confirm', validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, provisioned: false });

    expect(updatePayloads[0]!.status).toBe('signed');
    const clientEmail = sendEmailMock.mock.calls[0]![0].message;
    const ownerEmail = sendEmailMock.mock.calls[1]![0].message;
    expect(clientEmail.subject).toMatch(/received your signed proposal/i);
    expect(ownerEmail.subject).toMatch(/provisioning failed/i);
    expect(ownerEmail.html).toContain('Check the application logs');
    expect(ownerEmail.html).not.toContain('auth user mint failed');
  });

  it('2b. returned client-email error — signature stays committed but no sent timestamp is written', async () => {
    sendEmailMock.mockResolvedValueOnce({
      deliveryStatus: 'pending',
      deliveryId: 'delivery_1',
      providerId: null,
      errorCode: 'validation_error',
      errorMessage: 'recipient rejected',
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await POST(makeJsonRequest('http://test/api/proposals/sign/confirm', validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      provisioned: true,
      deliveryStatus: 'pending',
    });
    expect(updatePayloads[0]!.status).toBe('signed');
    expect(updatePayloads.some((item) => 'signed_email_sent_at' in item)).toBe(false);
    // The owner alert is independent and still attempted.
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
  });

  it('3. short ctoken — 400, no lookup', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals/sign/confirm', {
        ctoken: 'short',
      }),
    );
    expect(res.status).toBe(400);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it('4. unknown ctoken — 404, no commit', async () => {
    lookupResult = { data: null, error: null };
    const res = await POST(makeJsonRequest('http://test/api/proposals/sign/confirm', validBody));
    expect(res.status).toBe(404);
    expect(proposalUpdate).not.toHaveBeenCalled();
    expect(provisionFromSignedProposal).not.toHaveBeenCalled();
  });

  it('5. confirm token expired — 410, no commit', async () => {
    lookupResult = {
      data: pendingRow({ sign_confirm_expires_at: CPAST }),
      error: null,
    };
    const res = await POST(makeJsonRequest('http://test/api/proposals/sign/confirm', validBody));
    expect(res.status).toBe(410);
    expect(proposalUpdate).not.toHaveBeenCalled();
  });

  it('6. already signed — 409, no commit', async () => {
    lookupResult = { data: pendingRow({ status: 'active' }), error: null };
    const res = await POST(makeJsonRequest('http://test/api/proposals/sign/confirm', validBody));
    expect(res.status).toBe(409);
    expect(proposalUpdate).not.toHaveBeenCalled();
  });

  it('7. lost race — guarded commit matches zero rows → 409, no provisioning', async () => {
    updateRows = [];
    const res = await POST(makeJsonRequest('http://test/api/proposals/sign/confirm', validBody));
    expect(res.status).toBe(409);
    expect(provisionFromSignedProposal).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('8. no pending signature — 409, nothing committed', async () => {
    lookupResult = {
      data: pendingRow({
        pending_signature_name: null,
        pending_signature_method: null,
        pending_signature_image: null,
      }),
      error: null,
    };
    const res = await POST(makeJsonRequest('http://test/api/proposals/sign/confirm', validBody));
    expect(res.status).toBe(409);
    expect(proposalUpdate).not.toHaveBeenCalled();
  });

  it('9. rate limited — 429, no lookup', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      allowed: false,
      retryAfter: 30,
    });
    const res = await POST(makeJsonRequest('http://test/api/proposals/sign/confirm', validBody));
    expect(res.status).toBe(429);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });
});
