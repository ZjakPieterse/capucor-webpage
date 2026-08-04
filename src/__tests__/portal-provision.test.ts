import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db';
import {
  provisionFromSignedProposal,
  type ProposalForProvision,
} from '@/lib/portal/provision';

function proposal(
  overrides: Partial<ProposalForProvision> = {},
): ProposalForProvision {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: ' Pat@Example.com ',
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
    ...overrides,
  };
}

function makeAdmin(
  options: {
    createdUserId?: string | null;
    existingUserId?: string | null;
    rpcError?: { message: string; code?: string } | null;
    rpcRows?: Record<string, unknown>[];
  } = {},
) {
  const createUser = vi.fn(async () => ({
    data: {
      user:
        options.createdUserId === null
          ? null
          : { id: options.createdUserId ?? 'user_new' },
    },
    error:
      options.createdUserId === null ? { message: 'already registered' } : null,
  }));
  const generateLink = vi.fn(async () => ({
    data: {
      user:
        options.existingUserId === null
          ? null
          : { id: options.existingUserId ?? 'user_existing' },
    },
    error:
      options.existingUserId === null ? { message: 'locate failed' } : null,
  }));
  const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => {
    void _name;
    void _args;
    return {
      data: options.rpcRows ?? [
        {
          proposal_id: '11111111-1111-4111-8111-111111111111',
          org_id: '22222222-2222-4222-8222-222222222222',
          user_id: options.createdUserId ?? options.existingUserId ?? 'user_new',
          membership_id: '33333333-3333-4333-8333-333333333333',
          subscription_id: '44444444-4444-4444-8444-444444444444',
          org_created: true,
          membership_created: true,
          subscription_created: true,
          already_provisioned: false,
        },
      ],
      error: options.rpcError ?? null,
    };
  });
  return {
    client: {
      auth: { admin: { createUser, generateLink } },
      rpc,
    } as unknown as SupabaseClient<Database>,
    createUser,
    generateLink,
    rpc,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('provisionFromSignedProposal', () => {
  it('1. creates Auth first, then delegates all database invariants to the OS RPC', async () => {
    const admin = makeAdmin();
    const result = await provisionFromSignedProposal(admin.client, proposal());

    expect(result).toMatchObject({
      ok: true,
      orgId: '22222222-2222-4222-8222-222222222222',
      userId: 'user_new',
      created: { org: true, membership: true, subscription: true },
      alreadyProvisioned: false,
    });
    expect(admin.createUser).toHaveBeenCalledWith({
      email: 'pat@example.com',
      email_confirm: true,
    });
    expect(admin.rpc).toHaveBeenCalledWith('provision_from_signed_proposal', {
      p_proposal_id: '11111111-1111-4111-8111-111111111111',
      p_user_id: 'user_new',
      p_org_slug: 'pat-trading-co',
    });
  });

  it('2. locates the same Auth user on retry without sending a magic link', async () => {
    const admin = makeAdmin({
      createdUserId: null,
      existingUserId: 'user_existing',
    });
    const result = await provisionFromSignedProposal(admin.client, proposal());

    expect(result).toMatchObject({ ok: true, userId: 'user_existing' });
    expect(admin.generateLink).toHaveBeenCalledWith({
      type: 'magiclink',
      email: 'pat@example.com',
    });
    expect(admin.rpc.mock.calls[0]?.[1]).toMatchObject({
      p_user_id: 'user_existing',
    });
  });

  it('3. rejects a non-signed lifecycle state before touching Auth', async () => {
    const admin = makeAdmin();
    const result = await provisionFromSignedProposal(
      admin.client,
      proposal({ status: 'sent' }),
    );
    expect(result).toMatchObject({ ok: false });
    expect(admin.createUser).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it('4. retries active proposals so missing membership/subscription invariants can be repaired', async () => {
    const admin = makeAdmin({
      rpcRows: [
        {
          proposal_id: proposal().id,
          org_id: 'org_existing',
          user_id: 'user_new',
          membership_id: 'membership_repaired',
          subscription_id: 'subscription_existing',
          org_created: false,
          membership_created: true,
          subscription_created: false,
          already_provisioned: true,
        },
      ],
    });
    const result = await provisionFromSignedProposal(
      admin.client,
      proposal({ status: 'active', client_org_id: 'org_existing' }),
    );
    expect(result).toMatchObject({
      ok: true,
      alreadyProvisioned: true,
      created: { org: false, membership: true, subscription: false },
    });
    expect(admin.rpc).toHaveBeenCalledTimes(1);
  });

  it('5. Auth failure remains recoverable and never calls the database transaction', async () => {
    const admin = makeAdmin({ createdUserId: null, existingUserId: null });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await provisionFromSignedProposal(admin.client, proposal());
    expect(result).toMatchObject({ ok: false });
    expect(admin.rpc).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('6. a transaction error is returned as recoverable failure', async () => {
    const admin = makeAdmin({
      rpcError: { code: 'P0001', message: 'proposal_not_signed' },
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await provisionFromSignedProposal(admin.client, proposal());
    expect(result).toMatchObject({ ok: false, error: 'proposal_not_signed' });
    errorSpy.mockRestore();
  });

  it('7. no RPC row is treated as failure instead of false success', async () => {
    const admin = makeAdmin({ rpcRows: [] });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await provisionFromSignedProposal(admin.client, proposal());
    expect(result).toMatchObject({ ok: false });
    errorSpy.mockRestore();
  });

  it('8. the RPC receives no client-supplied pricing or lifecycle fields', async () => {
    const admin = makeAdmin();
    await provisionFromSignedProposal(
      admin.client,
      proposal({
        monthly_total_zar: '999999.00',
        total_charge_zar: '999999.00',
      }),
    );
    expect(Object.keys(admin.rpc.mock.calls[0]![1]).sort()).toEqual([
      'p_org_slug',
      'p_proposal_id',
      'p_user_id',
    ]);
  });

  it('9. slug normalization remains stable at the cross-repository boundary', async () => {
    const admin = makeAdmin();
    await provisionFromSignedProposal(
      admin.client,
      proposal({ business_name: '  Déjà Vu & Co.  ' }),
    );
    expect(admin.rpc.mock.calls[0]?.[1]).toMatchObject({
      p_org_slug: 'd-j-vu-co',
    });
  });

  it('10. an already-created Auth user is never followed by generateLink', async () => {
    const admin = makeAdmin({ createdUserId: 'user_created' });
    await provisionFromSignedProposal(admin.client, proposal());
    expect(admin.generateLink).not.toHaveBeenCalled();
  });

  it('11. one call produces exactly one transactional provisioning RPC', async () => {
    const admin = makeAdmin();
    await provisionFromSignedProposal(admin.client, proposal());
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    expect(admin.rpc.mock.calls.map(([name]) => name)).toEqual([
      'provision_from_signed_proposal',
    ]);
  });
});
