/**
 * Migration 005 (engagement-letter capture) run against real Postgres (PGlite,
 * in-process). The fixture is the live proposals table cut from
 * 000_baseline_funnel.sql plus 004 (already applied in production); 005 is then
 * applied exactly as Zjak will paste it. Nothing here touches the live database.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');
const baseline = readFileSync(join(MIGRATIONS, '000_baseline_funnel.sql'), 'utf8');
const m004 = readFileSync(join(MIGRATIONS, '004_plan_reviews.sql'), 'utf8');
const m005 = readFileSync(join(MIGRATIONS, '005_engagement_letter_capture.sql'), 'utf8');

function cut(src: string, start: string, end: string): string {
  const i = src.indexOf(start);
  const j = src.indexOf(end, i);
  if (i < 0 || j < 0) throw new Error(`baseline block not found: ${start}`);
  return src.slice(i, j + end.length);
}

const FIXTURE = `
  create role anon; create role authenticated; create role service_role;
  ${cut(baseline, 'create table public.proposals (', '\n);').replace(
    /references public\.(leads|client_orgs)\(id\) on delete set null/g,
    '',
  )};
  ${cut(baseline, 'create table public.proposal_fulfilment (', '\n);').replace(
    /references public\.email_deliveries\(id\)/g,
    '',
  )};
  ${cut(baseline, 'create or replace function public.commit_proposal_signature(', "same transaction.';")}
`;

function rollbackSql(): string {
  const lines = m005.slice(m005.indexOf('── ROLL BACK')).split('\n').slice(1);
  const all = lines.filter((l) => l.startsWith('-- ')).map((l) => l.slice(3));
  return all.slice(all.indexOf('begin;')).join('\n');
}

let db: PGlite;
let seq = 0;

async function insert(over: Record<string, unknown> = {}): Promise<void> {
  seq += 1;
  const row: Record<string, unknown> = {
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
    ...over,
  };
  const cols = Object.keys(row);
  await db.query(
    `insert into public.proposals (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`,
    Object.values(row),
  );
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(FIXTURE);
  await db.exec(m004);
  await insert(); // a row from before 005
  await db.exec(m005);
});

afterAll(async () => {
  await db.close();
});

describe('005_engagement_letter_capture.sql', () => {
  it('adds five columns and leaves existing rows unconfirmed with no version', async () => {
    const cols = await db.query<{ column_name: string; is_nullable: string; column_default: string | null }>(
      `select column_name, is_nullable, column_default from information_schema.columns
        where table_name = 'proposals' and column_name in ('client_legal_name',
          'client_registration_number', 'client_registered_address',
          'signer_authority_confirmed', 'terms_version') order by column_name`,
    );
    expect(cols.rows.map((r) => r.column_name)).toEqual([
      'client_legal_name',
      'client_registered_address',
      'client_registration_number',
      'signer_authority_confirmed',
      'terms_version',
    ]);
    const flag = cols.rows.find((r) => r.column_name === 'signer_authority_confirmed')!;
    expect(flag.is_nullable).toBe('NO');
    expect(flag.column_default).toBe('false');

    const old = await db.query<{ signer_authority_confirmed: boolean; terms_version: string | null }>(
      `select signer_authority_confirmed, terms_version from public.proposals where token = 'tok-1'`,
    );
    expect(old.rows[0]).toEqual({ signer_authority_confirmed: false, terms_version: null });
  });

  it('accepts a complete capture, with or without a registration number', async () => {
    const full = {
      client_legal_name: 'Acme Trading (Pty) Ltd',
      client_registered_address: '1 Main Road, Centurion, 0157',
      signer_authority_confirmed: true,
      terms_version: '2026.1',
    };
    await expect(insert({ ...full, client_registration_number: '2014/144982/07' })).resolves.toBeUndefined();
    await expect(insert(full)).resolves.toBeUndefined();
  });

  it('refuses a confirmed authority without the legal details or terms version', async () => {
    await expect(insert({ signer_authority_confirmed: true })).rejects.toThrow(
      /proposals_signer_authority_complete_check/,
    );
    await expect(
      insert({
        signer_authority_confirmed: true,
        client_legal_name: 'Acme',
        client_registered_address: '1 Main Road',
      }),
    ).rejects.toThrow(/proposals_signer_authority_complete_check/);
  });

  it('refuses untrimmed, empty or malformed values', async () => {
    await expect(insert({ client_legal_name: ' Acme' })).rejects.toThrow(/client_legal_name_check/);
    await expect(insert({ client_registration_number: '' })).rejects.toThrow(/registration_number_check/);
    await expect(insert({ client_registered_address: 'x' })).rejects.toThrow(/registered_address_check/);
    await expect(insert({ terms_version: 'v1' })).rejects.toThrow(/terms_version_check/);
  });

  it('refuses to run twice', async () => {
    await expect(db.exec(m005)).rejects.toThrow(/005: an engagement-letter column already exists/);
    await db.exec('rollback');
  });

  it('rolls back cleanly', async () => {
    await db.exec(rollbackSql());
    const left = await db.query(
      `select 1 from information_schema.columns where table_name = 'proposals'
        and column_name in ('client_legal_name', 'signer_authority_confirmed', 'terms_version')`,
    );
    expect(left.rows).toHaveLength(0);
  });
});
