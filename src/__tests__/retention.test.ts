import { describe, expect, it } from 'vitest';
import { isPrunableProposal, runRetention } from '@/lib/retention';

// A tiny in-memory stand-in for the supabase-js query builder: enough of
// select / delete with eq, is, in, lt and limit to run lib/retention.ts against
// real rows, so the tests check what is deleted, not which calls were made.
type Row = Record<string, unknown>;
type Db = Record<string, Row[]>;

function fakeSupabase(db: Db, failTable?: string) {
  return {
    from(table: string) {
      const filters: ((r: Row) => boolean)[] = [];
      let op: 'select' | 'delete' = 'select';
      let limit = Infinity;
      const b = {
        select() {
          op = 'select';
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
          filters.push((r) => vs.includes(r[col]));
          return b;
        },
        lt(col: string, v: string) {
          filters.push((r) => typeof r[col] === 'string' && (r[col] as string) < v);
          return b;
        },
        limit(n: number) {
          limit = n;
          return b;
        },
        then(resolve: (v: unknown) => void) {
          if (table === failTable) return resolve({ data: null, error: { code: 'XX', message: 'boom' }, count: null });
          const rows = db[table] ?? [];
          const hit = rows.filter((r) => filters.every((f) => f(r))).slice(0, limit);
          if (op === 'delete') {
            db[table] = rows.filter((r) => !hit.includes(r));
            return resolve({ data: null, error: null, count: hit.length });
          }
          return resolve({ data: hit, error: null, count: hit.length });
        },
      };
      return b;
    },
  };
}

const NOW = new Date('2026-11-06T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000).toISOString();

describe('isPrunableProposal', () => {
  it('keeps an unsigned proposal until 90 days after it expired', () => {
    expect(isPrunableProposal({ id: 'a', signed_at: null, expires_at: daysAgo(89), created_at: daysAgo(96) }, NOW)).toBe(false);
    expect(isPrunableProposal({ id: 'b', signed_at: null, expires_at: daysAgo(91), created_at: daysAgo(98) }, NOW)).toBe(true);
  });
  it('never prunes a signed proposal', () => {
    expect(isPrunableProposal({ id: 'c', signed_at: daysAgo(500), expires_at: daysAgo(500), created_at: daysAgo(507) }, NOW)).toBe(false);
  });
  it('falls back to created_at for old rows with no expiry', () => {
    expect(isPrunableProposal({ id: 'd', signed_at: null, expires_at: null, created_at: daysAgo(91) }, NOW)).toBe(true);
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
      ],
      plan_reviews: [{ id: 'r1', proposal_id: 'p-signed-old', new_proposal_id: 'p-review-sent' }],
      data_requests: [
        { id: 'd-old', created_at: daysAgo(800) },
        { id: 'd-recent', created_at: daysAgo(100) },
      ],
      email_deliveries: [
        { id: 'e-old', status: 'accepted', created_at: daysAgo(400) },
        { id: 'e-old-failed', status: 'permanently_failed', created_at: daysAgo(400) },
        { id: 'e-old-pending', status: 'retry_scheduled', created_at: daysAgo(400) },
        { id: 'e-old-signed', status: 'accepted', created_at: daysAgo(400) },
        { id: 'e-recent', status: 'accepted', created_at: daysAgo(30) },
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
      'p-review-sent', // a plan review points at it
      'p-signed-old',
      'p-signed-superseded', // was signed: a contract
    ]);
    expect(ids(db, 'data_requests')).toEqual(['d-recent']);
    expect(ids(db, 'email_deliveries')).toEqual([
      'e-old-pending', // the retry runner still owns it
      'e-old-signed', // evidence for a signed proposal
      'e-recent',
    ]);
  });

  it('runs every step even when one fails, and reports the failure', async () => {
    const db = seed();
    const result = await runRetention(fakeSupabase(db, 'plan_reviews') as never, NOW);
    expect(result.proposals).toEqual({ deleted: 0, error: 'XX: boom' });
    expect(result.leads.deleted).toBe(1);
    expect(result.data_requests.deleted).toBe(1);
    expect(result.email_deliveries.deleted).toBe(2);
    expect(db.proposals).toHaveLength(6);
  });
});
