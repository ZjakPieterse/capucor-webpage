import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  provisionFromSignedProposal,
  type ProposalForProvision,
} from '@/lib/portal/provision';

// ── A small in-memory fake of the service-role Supabase client, supporting just
//    the query shapes provision.ts uses (select/insert/update + eq/ilike/in +
//    maybeSingle/single + awaited builders) plus auth.admin. Backing the tables
//    with arrays makes the idempotency assertions (no duplicate rows) natural. ──

type Row = Record<string, unknown>;

interface FakeOptions {
  /** id returned by createUser; null → createUser "fails" (already registered). */
  newUserId?: string | null;
  /** id returned by the generateLink fallback (existing user). */
  existingUserId?: string;
  /** Both createUser + generateLink fail → auth mint throws. */
  authFail?: boolean;
  /** Table whose insert should return an error (simulates a mid-provision DB failure). */
  failInsertOn?: string;
}

function makeFakeAdmin(
  seed: Partial<Record<string, Row[]>> = {},
  opts: FakeOptions = {},
) {
  const tables: Record<string, Row[]> = {
    client_orgs: [...(seed.client_orgs ?? [])],
    client_org_members: [...(seed.client_org_members ?? [])],
    subscriptions: [...(seed.subscriptions ?? [])],
    proposals: [...(seed.proposals ?? [])],
  };
  let idCounter = 1;
  const nextId = (prefix: string) => `${prefix}_${idCounter++}`;

  const createUser = vi.fn(async () => {
    if (opts.authFail) return { data: { user: null }, error: { message: 'createUser boom' } };
    if (opts.newUserId === null) {
      return { data: { user: null }, error: { message: 'email already registered' } };
    }
    return { data: { user: { id: opts.newUserId ?? 'user_new' } }, error: null };
  });
  const generateLink = vi.fn(async () => {
    if (opts.authFail) return { data: { user: null }, error: { message: 'generateLink boom' } };
    return { data: { user: { id: opts.existingUserId ?? 'user_existing' } }, error: null };
  });

  function from(table: string) {
    const rows = tables[table];
    if (!rows) throw new Error(`unexpected table ${table}`);

    const state: {
      op: 'select' | 'insert' | 'update';
      payload?: Row;
      returnSelect?: boolean;
      filters: { col: string; val: unknown; kind: 'eq' | 'ilike' | 'in' }[];
    } = { op: 'select', filters: [] };

    function applyFilters(): Row[] {
      return rows.filter((r) =>
        state.filters.every((f) => {
          const v = r[f.col];
          if (f.kind === 'eq') return v === f.val;
          if (f.kind === 'ilike') return String(v).toLowerCase() === String(f.val).toLowerCase();
          if (f.kind === 'in') return Array.isArray(f.val) && (f.val as unknown[]).includes(v);
          return true;
        }),
      );
    }

    function exec(): { data: unknown; error: unknown } {
      if (state.op === 'select') return { data: applyFilters(), error: null };
      if (state.op === 'insert') {
        if (opts.failInsertOn === table) {
          return { data: null, error: { message: `insert failed on ${table}` } };
        }
        const row: Row = { id: nextId(table), created_at: new Date().toISOString(), ...state.payload };
        rows.push(row);
        return { data: state.returnSelect ? row : null, error: null };
      }
      // update
      const matched = applyFilters();
      for (const r of matched) Object.assign(r, state.payload);
      return { data: matched, error: null };
    }

    const builder = {
      select: (_cols?: string) => {
        state.returnSelect = true;
        return builder;
      },
      insert: (payload: Row) => {
        state.op = 'insert';
        state.payload = payload;
        return builder;
      },
      update: (payload: Row) => {
        state.op = 'update';
        state.payload = payload;
        return builder;
      },
      eq: (col: string, val: unknown) => {
        state.filters.push({ col, val, kind: 'eq' });
        return builder;
      },
      ilike: (col: string, val: unknown) => {
        state.filters.push({ col, val, kind: 'ilike' });
        return builder;
      },
      in: (col: string, val: unknown) => {
        state.filters.push({ col, val, kind: 'in' });
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => {
        if (state.op === 'select') return { data: applyFilters()[0] ?? null, error: null };
        const r = exec();
        return { data: r.data ?? null, error: r.error };
      },
      single: async () => {
        if (state.op === 'select') return { data: applyFilters()[0] ?? null, error: null };
        return exec();
      },
      then: (onF: (v: { data: unknown; error: unknown }) => unknown, onR?: (e: unknown) => unknown) =>
        Promise.resolve(exec()).then(onF, onR),
    };
    return builder;
  }

  const fake = {
    auth: { admin: { createUser, generateLink } },
    from,
    tables,
    createUser,
    generateLink,
  };
  return fake;
}

type FakeAdmin = ReturnType<typeof makeFakeAdmin>;
const asClient = (f: FakeAdmin) => f as unknown as SupabaseClient;

function signedProposal(overrides: Partial<ProposalForProvision> = {}): ProposalForProvision {
  return {
    id: 'prop_1',
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
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('provisionFromSignedProposal', () => {
  it('1. success — creates org + membership + subscription, promotes the proposal to active', async () => {
    const proposalRow: Row = { id: 'prop_1', status: 'signed', client_org_id: null };
    const fake = makeFakeAdmin({ proposals: [proposalRow] }, { newUserId: 'user_new' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await provisionFromSignedProposal(asClient(fake), signedProposal());

    expect(res.ok).toBe(true);
    expect(res.created).toEqual({ org: true, membership: true, subscription: true });
    expect(res.userId).toBe('user_new');

    // Exactly one of each record, no duplicates.
    expect(fake.tables.client_orgs).toHaveLength(1);
    expect(fake.tables.client_org_members).toHaveLength(1);
    expect(fake.tables.subscriptions).toHaveLength(1);

    const org = fake.tables.client_orgs[0]!;
    expect(org).toMatchObject({ name: 'Pat Trading Co', primary_contact_email: 'pat@example.com', status: 'active' });
    expect(typeof org.slug).toBe('string');

    expect(fake.tables.client_org_members[0]).toMatchObject({
      client_org_id: org.id,
      user_id: 'user_new',
      role: 'owner',
    });
    expect(fake.tables.subscriptions[0]).toMatchObject({
      client_org_id: org.id,
      status: 'active',
      tier_slug: 'pro',
      vat_zar: 0,
      total_charge_zar: 1325,
    });

    // Proposal promoted + linked.
    expect(proposalRow.status).toBe('active');
    expect(proposalRow.client_org_id).toBe(org.id);

    // createUser was called requesting a confirmed email.
    expect(fake.createUser).toHaveBeenCalledWith({ email: 'pat@example.com', email_confirm: true });
    errorSpy.mockRestore();
  });

  it('2. idempotent — already active + linked is a no-op (no auth calls, no writes)', async () => {
    const fake = makeFakeAdmin({ proposals: [{ id: 'prop_1', status: 'active', client_org_id: 'org_existing' }] });

    const res = await provisionFromSignedProposal(
      asClient(fake),
      signedProposal({ status: 'active', client_org_id: 'org_existing' }),
    );

    expect(res).toMatchObject({ ok: true, alreadyProvisioned: true, orgId: 'org_existing' });
    expect(fake.createUser).not.toHaveBeenCalled();
    expect(fake.tables.client_orgs).toHaveLength(0);
    expect(fake.tables.subscriptions).toHaveLength(0);
  });

  it('3. re-sign — reuses org/membership, OVERRIDES the subscription with the latest plan, no duplicates', async () => {
    const proposalRow: Row = { id: 'prop_1', status: 'signed', client_org_id: null };
    const fake = makeFakeAdmin(
      {
        proposals: [proposalRow],
        client_orgs: [
          { id: 'org_1', name: 'Pat Trading Co', slug: 'pat-trading-co', primary_contact_email: 'pat@example.com', status: 'active' },
        ],
        client_org_members: [{ id: 'm_1', client_org_id: 'org_1', user_id: 'user_existing', role: 'owner' }],
        // Existing plan is on the old tier — the new proposal must override it.
        subscriptions: [{ id: 'sub_1', client_org_id: 'org_1', status: 'active', tier_slug: 'basic', created_at: '2026-01-01' }],
      },
      // createUser "fails" (already registered) → generateLink returns the existing id.
      { newUserId: null, existingUserId: 'user_existing' },
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await provisionFromSignedProposal(asClient(fake), signedProposal({ tier_slug: 'pro' }));

    expect(res.ok).toBe(true);
    expect(res.created).toEqual({ org: false, membership: false, subscription: false });
    expect(res.orgId).toBe('org_1');
    expect(res.userId).toBe('user_existing');

    // No duplicates — and the single subscription now reflects the latest proposal.
    expect(fake.tables.client_orgs).toHaveLength(1);
    expect(fake.tables.client_org_members).toHaveLength(1);
    expect(fake.tables.subscriptions).toHaveLength(1);
    expect(fake.tables.subscriptions[0]).toMatchObject({ tier_slug: 'pro', total_charge_zar: 1325 });

    // Still promoted to active + linked.
    expect(proposalRow.status).toBe('active');
    expect(proposalRow.client_org_id).toBe('org_1');
    errorSpy.mockRestore();
  });

  it('4. guarded failure — auth mint throws → ok:false, proposal NOT promoted, no records', async () => {
    const proposalRow: Row = { id: 'prop_1', status: 'signed', client_org_id: null };
    const fake = makeFakeAdmin({ proposals: [proposalRow] }, { authFail: true });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await provisionFromSignedProposal(asClient(fake), signedProposal());

    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
    expect(fake.tables.client_orgs).toHaveLength(0);
    expect(fake.tables.subscriptions).toHaveLength(0);
    // Left signed, never half-provisioned to active.
    expect(proposalRow.status).toBe('signed');
    errorSpy.mockRestore();
  });

  it('5. mid-provision DB failure — subscription insert fails → ok:false, proposal stays signed', async () => {
    const proposalRow: Row = { id: 'prop_1', status: 'signed', client_org_id: null };
    const fake = makeFakeAdmin(
      { proposals: [proposalRow] },
      { newUserId: 'user_new', failInsertOn: 'subscriptions' },
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await provisionFromSignedProposal(asClient(fake), signedProposal());

    expect(res.ok).toBe(false);
    // Org + membership were created, but the sub failed, so we do NOT promote.
    expect(fake.tables.subscriptions).toHaveLength(0);
    expect(proposalRow.status).toBe('signed');
    expect(proposalRow.client_org_id).toBeNull();
    errorSpy.mockRestore();
  });

  it('6. invalid state — a non-signed proposal is a guarded no-op (ok:false, no auth, no writes)', async () => {
    const fake = makeFakeAdmin({ proposals: [{ id: 'prop_1', status: 'sent', client_org_id: null }] });

    const res = await provisionFromSignedProposal(asClient(fake), signedProposal({ status: 'sent' }));

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/cannot provision/i);
    expect(fake.createUser).not.toHaveBeenCalled();
    expect(fake.tables.client_orgs).toHaveLength(0);
  });

  it('7. dedupe is by organisation name — a different business (same contact email) gets its own org', async () => {
    const proposalRow: Row = { id: 'prop_2', status: 'signed', client_org_id: null };
    const fake = makeFakeAdmin(
      {
        proposals: [proposalRow],
        // Same contact email, DIFFERENT business name → a separate client.
        client_orgs: [
          { id: 'org_1', name: 'Pat Holdings', slug: 'pat-holdings', primary_contact_email: 'pat@example.com', status: 'active' },
        ],
      },
      { newUserId: 'user_new' },
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await provisionFromSignedProposal(
      asClient(fake),
      signedProposal({ id: 'prop_2', business_name: 'Pat Trading Co' }),
    );

    expect(res.ok).toBe(true);
    expect(res.created?.org).toBe(true);
    expect(fake.tables.client_orgs).toHaveLength(2);
    errorSpy.mockRestore();
  });

  it('8. same organisation name, DIFFERENT contact — reuses the one client, adds the new contact, overrides the plan', async () => {
    const proposalRow: Row = { id: 'prop_2', status: 'signed', client_org_id: null };
    const fake = makeFakeAdmin(
      {
        proposals: [proposalRow],
        client_orgs: [
          { id: 'org_1', name: 'Pat Trading Co', slug: 'pat-trading-co', primary_contact_email: 'alice@example.com', status: 'active' },
        ],
        client_org_members: [{ id: 'm_1', client_org_id: 'org_1', user_id: 'user_alice', role: 'owner' }],
        subscriptions: [{ id: 'sub_1', client_org_id: 'org_1', status: 'active', tier_slug: 'basic', created_at: '2026-01-01' }],
      },
      { newUserId: 'user_bob' },
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await provisionFromSignedProposal(
      asClient(fake),
      signedProposal({ id: 'prop_2', email: 'bob@example.com', first_name: 'Bob', business_name: 'Pat Trading Co', tier_slug: 'pro' }),
    );

    expect(res.ok).toBe(true);
    // One client (no duplicate), the new contact added as a member, plan overridden.
    expect(res.created).toEqual({ org: false, membership: true, subscription: false });
    expect(fake.tables.client_orgs).toHaveLength(1);
    expect(fake.tables.client_org_members).toHaveLength(2);
    expect(fake.tables.client_org_members.some((m) => m.user_id === 'user_bob' && m.client_org_id === 'org_1')).toBe(true);
    expect(fake.tables.subscriptions).toHaveLength(1);
    expect(fake.tables.subscriptions[0]).toMatchObject({ tier_slug: 'pro' });
    errorSpy.mockRestore();
  });
});
