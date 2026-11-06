/**
 * Migration 006 (signature without a registered address) run against real
 * Postgres (PGlite, in-process): the proposals table from the baseline, then
 * 004 and 005 (applied in production), then 006 exactly as Zjak will paste it.
 * Nothing here touches the live database.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');
const read = (f: string) => readFileSync(join(MIGRATIONS, f), 'utf8');
const baseline = read('000_baseline_funnel.sql');
const m004 = read('004_plan_reviews.sql');
const m005 = read('005_engagement_letter_capture.sql');
const m006 = read('006_sign_without_registered_address.sql');

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

const signedWithoutAddress = {
  client_legal_name: 'Acme Trading (Pty) Ltd',
  signer_authority_confirmed: true,
  terms_version: '2026.1',
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(FIXTURE);
  await db.exec(m004);
  await db.exec(m005);
  // A row signed under 005, with an address, before 006.
  await insert({ ...signedWithoutAddress, client_registered_address: '1 Main Road, Centurion, 0157' });
});

afterAll(async () => {
  await db.close();
});

describe('migration 006: sign without a registered address', () => {
  it('before 006, a confirmed authority without an address is refused', async () => {
    await expect(insert(signedWithoutAddress)).rejects.toThrow(/proposals_signer_authority_complete_check/);
  });

  it('applies, keeps the earlier address, and accepts a capture without one', async () => {
    await db.exec(m006);
    const old = await db.query<{ client_registered_address: string | null }>(
      `select client_registered_address from public.proposals where token = 'tok-1'`,
    );
    expect(old.rows[0]!.client_registered_address).toBe('1 Main Road, Centurion, 0157');
    await expect(insert(signedWithoutAddress)).resolves.toBeUndefined();
  });

  it('still requires the legal name and terms version', async () => {
    await expect(insert({ signer_authority_confirmed: true, terms_version: '2026.1' })).rejects.toThrow(
      /proposals_signer_authority_complete_check/,
    );
    await expect(
      insert({ signer_authority_confirmed: true, client_legal_name: 'Acme' }),
    ).rejects.toThrow(/proposals_signer_authority_complete_check/);
  });

  it('keeps the address format check for any address still written', async () => {
    await expect(insert({ client_registered_address: 'x' })).rejects.toThrow(/registered_address_check/);
  });

  it('refuses to run twice', async () => {
    await expect(db.exec(m006)).rejects.toThrow(/006: the 005 authority check is missing or already relaxed/);
    await db.exec('rollback');
  });
});
