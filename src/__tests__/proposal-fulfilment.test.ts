import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/portal/provision', () => ({
  provisionFromSignedProposal: vi.fn(),
}));
vi.mock('@/lib/portal/proposalPdf', () => ({ archiveSignedProposal: vi.fn() }));
vi.mock('@/lib/email/sendEmail', () => ({ sendEmail: vi.fn() }));

import { sendEmail } from '@/lib/email/sendEmail';
import { processProposalFulfilment } from '@/lib/portal/fulfilment';
import { archiveSignedProposal } from '@/lib/portal/proposalPdf';
import { provisionFromSignedProposal } from '@/lib/portal/provision';

const PROPOSAL_ID = '11111111-1111-4111-8111-111111111111';
const SIGNED_AT = '2026-08-04T08:00:00.000Z';

function proposal() {
  return {
    id: PROPOSAL_ID,
    token: 'proposal-token',
    ref_number: 'FT-2026-08-0001',
    email: 'pat@example.com',
    first_name: 'Pat',
    last_name: 'Patterson',
    business_name: 'Pat Trading Co',
    services: ['accounting'],
    brackets: { accounting: 0 },
    tier_slug: 'pro',
    addons: [],
    monthly_total_zar: 1325,
    vat_zar: 0,
    total_charge_zar: 1325,
    status: 'signed',
    client_org_id: null,
  };
}

function makeAdmin(stages: { stage: string; attempt?: number }[]) {
  const state = {
    portal_status: 'pending',
    pdf_status: 'pending',
    client_email_status: 'pending',
    owner_email_status: 'pending',
    completed_at: null as string | null,
  };
  const finishes: Record<string, unknown>[] = [];
  const signedEmailUpdates: Record<string, unknown>[] = [];
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === 'claim_proposal_fulfilment_stage') {
      const next = stages.shift();
      return {
        data: next
          ? [
              {
                proposal_id: PROPOSAL_ID,
                stage: next.stage,
                attempt_count: next.attempt ?? 1,
              },
            ]
          : [],
        error: null,
      };
    }
    if (name === 'finish_proposal_fulfilment_stage') {
      finishes.push(args);
      const stage = String(args.p_stage);
      const outcome = String(args.p_outcome);
      const status =
        outcome === 'success'
          ? stage.includes('email')
            ? 'accepted'
            : 'complete'
          : outcome;
      if (stage === 'portal') state.portal_status = status;
      if (stage === 'pdf') state.pdf_status = status;
      if (stage === 'client_email') state.client_email_status = status;
      if (stage === 'owner_email') state.owner_email_status = status;
      if (
        state.portal_status === 'complete' &&
        state.pdf_status === 'complete' &&
        state.client_email_status === 'accepted' &&
        ['accepted', 'not_required'].includes(state.owner_email_status)
      ) {
        state.completed_at = SIGNED_AT;
      }
      return { data: true, error: null };
    }
    throw new Error(`unexpected RPC ${name}`);
  });

  const client = {
    rpc,
    from: (table: string) => {
      if (table === 'proposal_fulfilment') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: state, error: null }),
            }),
          }),
        };
      }
      if (table === 'proposals') {
        return {
          update: (payload: Record<string, unknown>) => {
            signedEmailUpdates.push(payload);
            return { eq: () => ({ is: async () => ({ error: null }) }) };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient<Database>;

  return { client, state, finishes, signedEmailUpdates };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OWNER_NOTIFICATION_EMAIL = 'owner@capucor.com';
  vi.mocked(provisionFromSignedProposal).mockResolvedValue({
    ok: true,
    orgId: 'org_1',
  });
  vi.mocked(archiveSignedProposal).mockResolvedValue({
    ok: true,
    fileId: 'file_1',
  });
  vi.mocked(sendEmail).mockResolvedValue({
    deliveryStatus: 'accepted',
    deliveryId: '22222222-2222-4222-8222-222222222222',
    providerId: 'email_1',
    errorCode: null,
    errorMessage: null,
  });
});

describe('processProposalFulfilment', () => {
  it('converges all four stages in dependency order', async () => {
    const admin = makeAdmin([
      { stage: 'portal' },
      { stage: 'pdf' },
      { stage: 'client_email' },
      { stage: 'owner_email' },
    ]);
    const result = await processProposalFulfilment(
      admin.client,
      proposal(),
      SIGNED_AT,
    );

    expect(result).toEqual({
      provisioned: true,
      deliveryStatus: 'accepted',
      completed: true,
    });
    expect(admin.finishes.map((item) => item.p_stage)).toEqual([
      'portal',
      'pdf',
      'client_email',
      'owner_email',
    ]);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(admin.signedEmailUpdates).toHaveLength(1);
  });

  it('stops at a portal failure, schedules recovery and alerts the owner once', async () => {
    vi.mocked(provisionFromSignedProposal).mockResolvedValueOnce({
      ok: false,
      error: 'Auth temporarily unavailable',
    });
    const admin = makeAdmin([{ stage: 'portal' }]);
    const result = await processProposalFulfilment(
      admin.client,
      proposal(),
      SIGNED_AT,
    );

    expect(result).toMatchObject({
      provisioned: false,
      deliveryStatus: 'pending',
    });
    expect(admin.finishes[0]).toMatchObject({
      p_stage: 'portal',
      p_outcome: 'retry_scheduled',
      p_error_message: 'Auth temporarily unavailable',
    });
    expect(archiveSignedProposal).not.toHaveBeenCalled();
    expect(vi.mocked(sendEmail).mock.calls[0]?.[0]).toMatchObject({
      eventType: 'proposal.provision_failed_owner',
    });
  });

  it('stops at a PDF timeout and does not send premature client email', async () => {
    vi.mocked(archiveSignedProposal).mockResolvedValueOnce({
      ok: false,
      error: 'The operation was aborted due to timeout',
    });
    const admin = makeAdmin([{ stage: 'portal' }, { stage: 'pdf' }]);
    const result = await processProposalFulfilment(
      admin.client,
      proposal(),
      SIGNED_AT,
    );

    expect(result).toMatchObject({
      provisioned: true,
      deliveryStatus: 'pending',
    });
    expect(admin.finishes[1]).toMatchObject({
      p_stage: 'pdf',
      p_outcome: 'retry_scheduled',
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('links a pending client delivery without writing the sent timestamp', async () => {
    vi.mocked(sendEmail).mockResolvedValueOnce({
      deliveryStatus: 'pending',
      deliveryId: '22222222-2222-4222-8222-222222222222',
      providerId: null,
      errorCode: 'timeout',
      errorMessage: 'provider timeout',
    });
    const admin = makeAdmin([
      { stage: 'portal' },
      { stage: 'pdf' },
      { stage: 'client_email' },
    ]);
    const result = await processProposalFulfilment(
      admin.client,
      proposal(),
      SIGNED_AT,
    );

    expect(result.deliveryStatus).toBe('pending');
    expect(admin.finishes[2]).toMatchObject({
      p_stage: 'client_email',
      p_outcome: 'retry_scheduled',
      p_delivery_id: '22222222-2222-4222-8222-222222222222',
    });
    expect(admin.signedEmailUpdates).toHaveLength(0);
  });

  it('marks owner email not required when no owner recipient is configured', async () => {
    delete process.env.OWNER_NOTIFICATION_EMAIL;
    const admin = makeAdmin([
      { stage: 'portal' },
      { stage: 'pdf' },
      { stage: 'client_email' },
      { stage: 'owner_email' },
    ]);
    const result = await processProposalFulfilment(
      admin.client,
      proposal(),
      SIGNED_AT,
    );

    expect(result.completed).toBe(true);
    expect(admin.finishes[3]).toMatchObject({
      p_stage: 'owner_email',
      p_outcome: 'not_required',
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('turns the sixth portal failure into visible permanent failure', async () => {
    vi.mocked(provisionFromSignedProposal).mockResolvedValueOnce({
      ok: false,
      error: 'still down',
    });
    const admin = makeAdmin([{ stage: 'portal', attempt: 6 }]);
    await processProposalFulfilment(admin.client, proposal(), SIGNED_AT);
    expect(admin.finishes[0]).toMatchObject({
      p_outcome: 'permanently_failed',
      p_error_code: 'max_attempts_exhausted',
    });
  });

  it('a lost claim performs no external side effect', async () => {
    const admin = makeAdmin([]);
    const result = await processProposalFulfilment(
      admin.client,
      proposal(),
      SIGNED_AT,
    );
    expect(result.deliveryStatus).toBe('pending');
    expect(provisionFromSignedProposal).not.toHaveBeenCalled();
    expect(archiveSignedProposal).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
