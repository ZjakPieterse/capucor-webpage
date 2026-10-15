/**
 * Migration 004 (plan reviews) run against real Postgres (PGlite, in-process).
 *
 * The fixture is cut from 000_baseline_funnel.sql — the live proposals and
 * proposal_fulfilment tables and the live commit_proposal_signature — and then
 * 004_plan_reviews.sql is applied exactly as Zjak will paste it. Nothing here
 * touches the live database.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');
const baseline = readFileSync(join(MIGRATIONS, '000_baseline_funnel.sql'), 'utf8');
const m004 = readFileSync(join(MIGRATIONS, '004_plan_reviews.sql'), 'utf8');

function cut(src: string, start: string, end: string): string {
  const i = src.indexOf(start);
  const j = src.indexOf(end, i);
  if (i < 0 || j < 0) throw new Error(`baseline block not found: ${start}`);
  return src.slice(i, j + end.length);
}

const proposalsTable = cut(baseline, 'create table public.proposals (', '\n);')
  // leads and client_orgs are outside this fixture.
  .replace(/references public\.(leads|client_orgs)\(id\) on delete set null/g, '');
const fulfilmentTable = cut(baseline, 'create table public.proposal_fulfilment (', '\n);')
  // email_deliveries is outside this fixture.
  .replace(/references public\.email_deliveries\(id\)/g, '');
const signFn000 = cut(
  baseline,
  'create or replace function public.commit_proposal_signature(',
  "same transaction.';",
);

const FIXTURE = `
  create role anon; create role authenticated; create role service_role;
  ${proposalsTable};
  ${fulfilmentTable};
  ${signFn000}
`;

/** The ROLL BACK block, uncommented, with the 000 function pasted where it says. */
function rollbackSql(): string {
  const lines = m004.slice(m004.indexOf('── ROLL BACK')).split('\n').slice(1);
  const all = lines.filter((l) => l.startsWith('-- ')).map((l) => l.slice(3));
  const sql = all.slice(all.indexOf('begin;')).filter((l) => !l.startsWith('--'));
  sql.splice(1, 0, signFn000);
  return sql.join('\n');
}

async function freshDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(FIXTURE);
  await db.exec(m004);
  return db;
}

type Row = Record<string, unknown>;

let seq = 0;
async function insertProposal(db: PGlite, over: Row = {}): Promise<string> {
  seq += 1;
  const row: Row = {
    token: `tok-${seq}`,
    first_name: 'Test',
    last_name: 'Client',
    business_name: `Biz ${seq}`,
    email: `c${seq}@example.test`,
    services: '{monthly-accounting}',
    brackets: '{}',
    tier_slug: 'essentials',
    monthly_total_zar: 1000,
    vat_zar: 150,
    total_charge_zar: 1150,
    status: 'sent',
    // A review must state its start date (decision #7); default one in.
    ...(over.kind === 'review' && !('effective_from' in over) ? { effective_from: '2026-12-01' } : {}),
    ...over,
  };
  const cols = Object.keys(row);
  const res = await db.query<{ id: string }>(
    `insert into public.proposals (${cols.join(', ')})
     values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
    Object.values(row),
  );
  return res.rows[0].id;
}

/** A proposal ready for commit_proposal_signature (confirm step done). */
function readyToSign(over: Row = {}): Row {
  seq += 1;
  return {
    status: 'sent',
    sign_confirm_token: `confirm-${seq}`,
    sign_confirm_expires_at: '2099-01-01T00:00:00Z',
    pending_signature_name: 'Test Client',
    pending_signature_method: 'typed',
    pending_signature_image: 'data:image/png;base64,AA==',
    ...over,
  };
}

async function sign(db: PGlite, id: string, signedAt: string): Promise<boolean> {
  const tok = await db.query<{ sign_confirm_token: string }>(
    'select sign_confirm_token from public.proposals where id = $1',
    [id],
  );
  const res = await db.query(
    'select * from public.commit_proposal_signature($1, $2, $3)',
    [id, tok.rows[0].sign_confirm_token, signedAt],
  );
  return res.rows.length === 1;
}

async function get(db: PGlite, id: string): Promise<Row> {
  const res = await db.query<Row>(
    `select status, superseded_by_id, supersedes_id, signed_at,
            to_char(effective_from, 'YYYY-MM-DD') as effective_from
       from public.proposals where id = $1`,
    [id],
  );
  return res.rows[0];
}

const fulfilmentCount = async (db: PGlite, id: string) =>
  (await db.query('select 1 from public.proposal_fulfilment where proposal_id = $1', [id])).rows
    .length;

describe('migration 004: plan reviews', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await freshDb();
  });
  afterAll(async () => {
    await db.close();
  });
  beforeEach(async () => {
    await db.exec('delete from public.plan_reviews; delete from public.proposal_fulfilment; delete from public.proposals;');
  });

  it('is run-once: a second apply aborts and changes nothing', async () => {
    await expect(db.exec(m004)).rejects.toThrow(/004: .* already exists/);
    await db.exec('rollback'); // the failed run leaves its transaction aborted
  });

  it('signs a plain proposal exactly as before (no supersede, no effective_from)', async () => {
    const id = await insertProposal(db, readyToSign());
    expect(await sign(db, id, '2026-11-10T09:00:00Z')).toBe(true);
    const row = await get(db, id);
    expect(row.status).toBe('signed');
    expect(row.effective_from).toBeNull();
    expect(await fulfilmentCount(db, id)).toBe(1);
  });

  it('defaults existing and new rows to kind = new', async () => {
    const id = await insertProposal(db);
    const res = await db.query<{ kind: string }>('select kind from public.proposals where id = $1', [id]);
    expect(res.rows[0].kind).toBe('new');
  });

  describe('supersede on sign', () => {
    for (const oldStatus of ['signed', 'active']) {
      it(`supersedes an in-force '${oldStatus}' plan in the signing transaction`, async () => {
        const oldId = await insertProposal(db, { status: oldStatus });
        const newId = await insertProposal(
          db,
          readyToSign({ kind: 'review', supersedes_id: oldId, effective_from: '2026-12-01' }),
        );
        expect(await sign(db, newId, '2026-11-10T09:00:00Z')).toBe(true);
        expect(await get(db, newId)).toMatchObject({ status: 'signed', effective_from: '2026-12-01' });
        expect(await get(db, oldId)).toMatchObject({ status: 'superseded', superseded_by_id: newId });
      });
    }

    it('leaves the old plan in force while the review is only sent or viewed', async () => {
      const oldId = await insertProposal(db, { status: 'signed' });
      const newId = await insertProposal(
        db,
        readyToSign({ kind: 'review', supersedes_id: oldId, status: 'viewed' }),
      );
      expect(await get(db, oldId)).toMatchObject({ status: 'signed', superseded_by_id: null });
      // An expired review leaves it alone too.
      await db.query("update public.proposals set status = 'expired' where id = $1", [newId]);
      expect(await get(db, oldId)).toMatchObject({ status: 'signed', superseded_by_id: null });
    });

    it('leaves the old plan in force when the review signature is refused', async () => {
      const oldId = await insertProposal(db, { status: 'signed' });
      const newId = await insertProposal(
        db,
        readyToSign({
          kind: 'review',
          supersedes_id: oldId,
          sign_confirm_expires_at: '2026-01-01T00:00:00Z',
        }),
      );
      expect(await sign(db, newId, '2026-11-10T09:00:00Z')).toBe(false);
      expect(await get(db, oldId)).toMatchObject({ status: 'signed', superseded_by_id: null });
    });

    for (const oldStatus of ['superseded', 'expired', 'sent']) {
      it(`refuses the signature when the old plan is '${oldStatus}' (not in force)`, async () => {
        const oldId = await insertProposal(db, { status: oldStatus });
        const newId = await insertProposal(
          db,
          readyToSign({ kind: 'review', supersedes_id: oldId }),
        );
        expect(await sign(db, newId, '2026-11-10T09:00:00Z')).toBe(false);
        const row = await get(db, newId);
        expect(row.status).toBe('sent');
        expect(row.signed_at).toBeNull();
        expect(await fulfilmentCount(db, newId)).toBe(0);
        expect((await get(db, oldId)).status).toBe(oldStatus);
      });
    }

    it('refuses the signature when the old plan is active but already has superseded_by_id', async () => {
      const other = await insertProposal(db, { status: 'signed' });
      const oldId = await insertProposal(db, { status: 'active', superseded_by_id: other });
      const newId = await insertProposal(db, readyToSign({ kind: 'review', supersedes_id: oldId }));
      expect(await sign(db, newId, '2026-11-10T09:00:00Z')).toBe(false);
      expect(await get(db, oldId)).toMatchObject({ status: 'active', superseded_by_id: other });
      expect((await get(db, newId)).status).toBe('sent');
    });

    it('refuses the second of two reviews of one plan (sequential; the row lock is verified by reading)', async () => {
      const oldId = await insertProposal(db, { status: 'signed' });
      const a = await insertProposal(db, readyToSign({ kind: 'review', supersedes_id: oldId }));
      // Only one review can be open at a time (index), so B can exist only once A
      // has left sent/viewed — here, by being signed. B must then be refused.
      expect(await sign(db, a, '2026-11-10T09:00:00Z')).toBe(true);
      const b = await insertProposal(db, readyToSign({ kind: 'review', supersedes_id: oldId }));
      expect(await sign(db, b, '2026-11-11T09:00:00Z')).toBe(false);
      expect(await get(db, oldId)).toMatchObject({ status: 'superseded', superseded_by_id: a });
      expect((await get(db, b)).status).toBe('sent');
    });

    it('is atomic: if any later step fails, neither row changes', async () => {
      const oldId = await insertProposal(db, { status: 'signed' });
      const newId = await insertProposal(
        db,
        readyToSign({ kind: 'review', supersedes_id: oldId, effective_from: '2026-12-01' }),
      );
      await db.exec(`
        create function public.fail_fulfilment() returns trigger language plpgsql
          as $$ begin raise exception 'boom'; end $$;
        create trigger fail_fulfilment before insert on public.proposal_fulfilment
          for each row execute function public.fail_fulfilment();
      `);
      try {
        await expect(sign(db, newId, '2026-12-05T09:00:00Z')).rejects.toThrow(/boom/);
      } finally {
        await db.exec('drop trigger fail_fulfilment on public.proposal_fulfilment; drop function public.fail_fulfilment();');
      }
      expect(await get(db, oldId)).toMatchObject({ status: 'signed', superseded_by_id: null });
      expect(await get(db, newId)).toMatchObject({
        status: 'sent',
        signed_at: null,
        effective_from: '2026-12-01',
      });
    });

    it('allows only one open review per plan', async () => {
      const oldId = await insertProposal(db, { status: 'signed' });
      await insertProposal(db, { kind: 'review', supersedes_id: oldId, status: 'sent' });
      await expect(
        insertProposal(db, { kind: 'review', supersedes_id: oldId, status: 'viewed' }),
      ).rejects.toThrow(/proposals_one_open_review_idx/);
    });
  });

  describe('effective_from', () => {
    const cases: Array<[string, string, string]> = [
      // [effective_from, signed_at (UTC), expected]
      ['2026-12-01', '2026-11-30T21:59:00Z', '2026-12-01'], // 23:59 SAST on 30 Nov: unchanged
      ['2026-12-01', '2026-11-30T22:00:00Z', '2027-01-01'], // 00:00 SAST on 1 Dec: rolls
      ['2026-12-01', '2026-12-15T09:00:00Z', '2027-01-01'], // mid-month: next 1st
      ['2026-12-01', '2027-02-03T09:00:00Z', '2027-03-01'], // months late: 1st after signing
    ];
    for (const [from, at, want] of cases) {
      it(`${from} signed at ${at} → ${want}`, async () => {
        const id = await insertProposal(
          db,
          readyToSign({ kind: 'review', replaces_legacy_ref: 'EL-2024-007', effective_from: from }),
        );
        expect(await sign(db, id, at)).toBe(true);
        expect((await get(db, id)).effective_from).toBe(want);
      });
    }

    it('must be a 1st of the month', async () => {
      await expect(insertProposal(db, { effective_from: '2026-12-02' })).rejects.toThrow(
        /proposals_effective_from_first_check/,
      );
    });
  });

  describe('constraints', () => {
    it('a review replaces exactly one thing', async () => {
      await expect(insertProposal(db, { kind: 'review' })).rejects.toThrow(
        /proposals_review_replaces_one_check/,
      );
      const oldId = await insertProposal(db, { status: 'signed' });
      await expect(
        insertProposal(db, { kind: 'review', supersedes_id: oldId, replaces_legacy_ref: 'EL-1' }),
      ).rejects.toThrow(/proposals_review_replaces_one_check/);
    });

    it('a review must state effective_from', async () => {
      await expect(
        insertProposal(db, { kind: 'review', replaces_legacy_ref: 'EL-1', effective_from: null }),
      ).rejects.toThrow(/proposals_review_effective_from_check/);
    });

    it('rejects an unknown kind', async () => {
      await expect(insertProposal(db, { kind: 'amendment' })).rejects.toThrow(/proposals_kind_check/);
    });

    it('plan_reviews: proposal_sent needs new_proposal_id, no_change must not have one', async () => {
      const plan = await insertProposal(db, { status: 'signed' });
      await db.query("insert into public.plan_reviews (proposal_id, outcome) values ($1, 'no_change')", [plan]);
      await expect(
        db.query("insert into public.plan_reviews (proposal_id, outcome) values ($1, 'proposal_sent')", [plan]),
      ).rejects.toThrow(/plan_reviews_new_proposal_check/);
      await expect(
        db.query(
          "insert into public.plan_reviews (proposal_id, outcome, new_proposal_id) values ($1, 'no_change', $1)",
          [plan],
        ),
      ).rejects.toThrow(/plan_reviews_new_proposal_check/);
    });

    it('plan_reviews is service-role only, with RLS on', async () => {
      const res = await db.query<Row>(`
        select relrowsecurity as rls,
               has_table_privilege('anon', 'public.plan_reviews', 'select') as anon_sel,
               has_table_privilege('authenticated', 'public.plan_reviews', 'select') as auth_sel,
               has_table_privilege('service_role', 'public.plan_reviews', 'insert') as svc_ins,
               has_function_privilege('anon', 'public.commit_proposal_signature(uuid,text,timestamptz)', 'execute') as anon_exec
          from pg_class where oid = 'public.plan_reviews'::regclass`);
      expect(res.rows[0]).toEqual({
        rls: true,
        anon_sel: false,
        auth_sel: false,
        svc_ins: true,
        anon_exec: false,
      });
    });
  });
});

describe('migration 004: rollback block', () => {
  it('restores the 000 schema and signing function', async () => {
    const db = await freshDb();
    try {
      await db.exec(rollbackSql());
      const cols = await db.query(
        `select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'proposals'
            and column_name in ('kind','effective_from','change_summary','replaces_legacy_ref','previous_monthly_zar')`,
      );
      expect(cols.rows).toHaveLength(0);
      const t = await db.query<{ r: string | null }>("select to_regclass('public.plan_reviews')::text as r");
      expect(t.rows[0].r).toBeNull();
      const fn = await db.query<{ src: string }>(
        "select prosrc as src from pg_proc where oid = to_regprocedure('public.commit_proposal_signature(uuid,text,timestamptz)')",
      );
      expect(fn.rows[0].src).not.toContain('Africa/Johannesburg');
      // And 004 can be applied again afterwards.
      await db.exec(m004);
    } finally {
      await db.close();
    }
  });
});
