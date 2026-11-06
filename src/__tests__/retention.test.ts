import { describe, expect, it } from 'vitest';
import { BATCH, isPrunableProposal, runRetention } from '@/lib/retention';

// A small in-memory stand-in for the supabase-js query builder: enough of
// select / delete with eq, is, in, lt, order and limit to run lib/retention.ts
// against real rows, so the tests check what is deleted, not which calls were
// made. Unlike a plain fake it also behaves like PostgREST where that has bitten:
//  - an `in` list longer than BATCH fails, as an over-long request URL would;
//  - deleting a row named in `blocked` fails with 23503, as a foreign key would.
type Row = Record<string, unknown>;
type Db = Record<string, Row[]>;

interface FakeOptions {
  failTable?: string;
  blocked?: Set<string>;
  inCalls?: number[];
}

function fakeSupabase(db: Db, opts: FakeOptions = {}) {
  return {
    from(table: string) {
      const filters: ((r: Row) => boolean)[] = [];
      let op: 'select' | 'delete' = 'select';
      let limit = Infinity;
      let tooLong = false;
      let columns: string[] | null = null;
      const b = {
        // Like PostgREST, return only the selected columns, in order.
        select(cols?: string) {
          op = 'select';
          columns = cols && cols !== '*' ? cols.split(',').map((c) => c.trim()) : null;
          return b;
        },
        delete() {
          op = 'delete';
          return b;
        },
        eq(col: string, v: unknown) {
          filters.push((r) => r[col] === v);
          return b;
        },
        is(col: string, v: unknown) {
          filters.push((r) => (r[col] ?? null) === v);
          return b;
        },
        in(col: string, vs: unknown[]) {
          opts.inCalls?.push(vs.length);
          if (vs.length > BATCH) tooLong = true;
          filters.push((r) => vs.includes(r[col]));
          return b;
        },
        lt(col: string, v: string) {
          filters.push((r) => typeof r[col] === 'string' && (r[col] as string) < v);
          return b;
        },
        order() {
          return b;
        },
        limit(n: number) {
          limit = n;
          return b;
        },
        then(resolve: (v: unknown) => void) {
          if (table === opts.failTable) return resolve({ data: null, error: { code: 'XX', message: 'boom' } });
          if (tooLong) return resolve({ data: null, error: { code: '414', message: 'URI too long' } });
          const rows = db[table] ?? [];
          const hit = rows.filter((r) => filters.every((f) => f(r))).slice(0, limit);
          if (op === 'delete') {
            if (hit.some((r) => opts.blocked?.has(r.id as string))) {
              return resolve({ data: null, error: { code: '23503', message: 'violates foreign key' }, count: null });
            }
            db[table] = rows.filter((r) => !hit.includes(r));
            return resolve({ data: null, error: null, count: hit.length });
          }
          const cols = columns;
          const data = cols ? hit.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? null]))) : hit;
          return resolve({ data, error: null, count: hit.length });
        },
      };
      return b;
    },
  };
}

const NOW = new Date('2026-11-06T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000).toISOString();

describe('isPrunableProposal', () => {
  const row = (over: Partial<Parameters<typeof isPrunableProposal>[0]>) => ({
    id: 'x',
    status: 'expired',
    signed_at: null,
    expires_at: daysAgo(91),
    created_at: daysAgo(98),
    ...over,
  });
  it('keeps an unsigned proposal until 90 days after it expired', () => {
    expect(isPrunableProposal(row({ expires_at: daysAgo(89) }), NOW)).toBe(false);
    expect(isPrunableProposal(row({ expires_at: daysAgo(91) }), NOW)).toBe(true);
  });
  it('never prunes a signed proposal', () => {
    expect(isPrunableProposal(row({ status: 'superseded', signed_at: daysAgo(500), expires_at: daysAgo(500) }), NOW)).toBe(false);
  });
  it('never prunes an old sent or viewed row with no expiry: it can still be signed', () => {
    expect(isPrunableProposal(row({ status: 'sent', expires_at: null, created_at: daysAgo(400) }), NOW)).toBe(false);
    expect(isPrunableProposal(row({ status: 'viewed', expires_at: null, created_at: daysAgo(400) }), NOW)).toBe(false);
    expect(isPrunableProposal(row({ status: 'declined', expires_at: null, created_at: daysAgo(400) }), NOW)).toBe(true);
  });
});

describe('runRetention', () => {
  function seed(): Db {
    return {
      leads: [
        { id: 'l-old-new', status: 'new', created_at: daysAgo(400) },
        { id: 'l-old-engaged', status: 'converted', created_at: daysAgo(400) },
        { id: 'l-recent', status: 'new', created_at: daysAgo(10) },
      ],
      proposals: [
        { id: 'p-expired-old', status: 'expired', signed_at: null, expires_at: daysAgo(100), created_at: daysAgo(107) },
        { id: 'p-expired-recent', status: 'expired', signed_at: null, expires_at: daysAgo(30), created_at: daysAgo(37) },
        { id: 'p-signed-old', status: 'signed', signed_at: daysAgo(400), expires_at: daysAgo(400), created_at: daysAgo(407) },
        { id: 'p-signed-superseded', status: 'superseded', signed_at: daysAgo(400), expires_at: daysAgo(400), created_at: daysAgo(407) },
        { id: 'p-unsigned-superseded', status: 'superseded', signed_at: null, expires_at: daysAgo(200), created_at: daysAgo(207) },
        { id: 'p-review-sent', status: 'expired', signed_at: null, expires_at: daysAgo(200), created_at: daysAgo(207) },
        { id: 'p-legacy-open', status: 'sent', signed_at: null, expires_at: null, created_at: daysAgo(400) },
      ],
      plan_reviews: [{ id: 'r1', proposal_id: 'p-signed-old', new_proposal_id: 'p-review-sent' }],
      data_requests: [
        { id: 'd-old', created_at: daysAgo(800) },
        { id: 'd-recent', created_at: daysAgo(100) },
      ],
      email_deliveries: [
        { id: 'e-old', source_type: 'lead', status: 'accepted', created_at: daysAgo(400) },
        { id: 'e-old-failed', source_type: 'proposal', status: 'permanently_failed', created_at: daysAgo(400) },
        { id: 'e-old-pending', source_type: 'lead', status: 'retry_scheduled', created_at: daysAgo(400) },
        { id: 'e-old-signed', source_type: 'proposal', status: 'accepted', created_at: daysAgo(400) },
        { id: 'e-old-portal', source_type: 'request_email', status: 'accepted', created_at: daysAgo(400) },
        { id: 'e-recent', source_type: 'data_request', status: 'accepted', created_at: daysAgo(30) },
      ],
      proposal_fulfilment: [
        { proposal_id: 'p-signed-old', client_email_delivery_id: 'e-old-signed', owner_email_delivery_id: null },
      ],
    };
  }
  const ids = (db: Db, t: string) => db[t].map((r) => r.id).sort();

  it('deletes only what is past its period, and keeps contracts and their evidence', async () => {
    const db = seed();
    const result = await runRetention(fakeSupabase(db) as never, NOW);

    expect(result).toEqual({
      leads: { deleted: 1 },
      proposals: { deleted: 2 },
      data_requests: { deleted: 1 },
      email_deliveries: { deleted: 2 },
    });
    expect(ids(db, 'leads')).toEqual(['l-old-engaged', 'l-recent']);
    expect(ids(db, 'proposals')).toEqual([
      'p-expired-recent',
      'p-legacy-open', // no expiry, still signable
      'p-review-sent', // a plan review points at it
      'p-signed-old',
      'p-signed-superseded', // was signed: a contract
    ]);
    expect(ids(db, 'data_requests')).toEqual(['d-recent']);
    expect(ids(db, 'email_deliveries')).toEqual([
      'e-old-pending', // the retry runner still owns it
      'e-old-portal', // the portal's row, not ours
      'e-old-signed', // evidence for a signed proposal
      'e-recent',
    ]);
  });

  it('runs every step even when one fails, and reports the failure', async () => {
    const db = seed();
    const result = await runRetention(fakeSupabase(db, { failTable: 'plan_reviews' }) as never, NOW);
    expect(result.proposals).toEqual({ deleted: 0, error: 'XX: boom' });
    expect(result.leads.deleted).toBe(1);
    expect(result.data_requests.deleted).toBe(1);
    expect(result.email_deliveries.deleted).toBe(2);
    expect(db.proposals).toHaveLength(7);
  });

  it('keeps every lookup and delete within BATCH ids, even with a large backlog', async () => {
    const db = seed();
    for (let i = 0; i < 250; i++) {
      db.proposals.push({ id: `bulk-${i}`, status: 'expired', signed_at: null, expires_at: daysAgo(120), created_at: daysAgo(127) });
    }
    const inCalls: number[] = [];
    const result = await runRetention(fakeSupabase(db, { inCalls }) as never, NOW);
    expect(result.proposals).toEqual({ deleted: 252 });
    expect(Math.max(...inCalls)).toBeLessThanOrEqual(BATCH);
  });

  it('skips a row a foreign key blocks and deletes the rest of its batch', async () => {
    const db = seed();
    const result = await runRetention(fakeSupabase(db, { blocked: new Set(['e-old']) }) as never, NOW);
    expect(result.email_deliveries).toEqual({ deleted: 1, skipped: 1 });
    expect(ids(db, 'email_deliveries')).toContain('e-old');
    expect(ids(db, 'email_deliveries')).not.toContain('e-old-failed');
  });
});
