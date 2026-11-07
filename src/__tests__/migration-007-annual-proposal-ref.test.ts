/**
 * Migration 007 (annual proposal references) run against real Postgres
 * (PGlite, in-process). The fixture is the live counter table and functions
 * cut from 000_baseline_funnel.sql; 007 is applied exactly as Zjak will paste
 * it. Nothing here touches the live database.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');
const baseline = readFileSync(join(MIGRATIONS, '000_baseline_funnel.sql'), 'utf8');
const m007 = readFileSync(join(MIGRATIONS, '007_annual_proposal_ref.sql'), 'utf8');

function cut(src: string, start: string, end: string): string {
  const i = src.indexOf(start);
  const j = src.indexOf(end, i);
  if (i < 0 || j < 0) throw new Error(`baseline block not found: ${start}`);
  return src.slice(i, j + end.length);
}

const FIXTURE = `
  create role anon; create role authenticated; create role service_role;
  ${cut(baseline, '-- ── Reference numbers', 'grant execute on function public.proposals_set_ref() to service_role;')}
  create table public.proposals (id serial primary key, ref_number text unique, name text);
  create trigger proposals_set_ref before insert on public.proposals
    for each row execute function public.proposals_set_ref();
`;

const thisYear = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric' }).format(new Date());

async function db(seed: [string, number][] = []): Promise<PGlite> {
  const d = new PGlite();
  await d.exec(FIXTURE);
  for (const [period, n] of seed) {
    await d.query('insert into public.proposal_ref_counters values ($1, $2)', [period, n]);
  }
  await d.exec(m007);
  return d;
}

async function refAt(d: PGlite, at: string): Promise<string> {
  const r = await d.query<{ ref: string }>('select public.proposal_ref_for($1::timestamptz) as ref', [at]);
  return r.rows[0].ref;
}

// PGlite boots per test; under the full parallel suite that can pass 5 s.
describe('migration 007 — FT-YYYYMMNNNN with a yearly count', { timeout: 30_000 }, () => {
  it('continues the year’s count from the monthly counters already used', async () => {
    const y = thisYear();
    // 2026-like history: 4 issued in one month, 2 in another, plus a prior year.
    const d = await db([[`${y}-10`, 4], [`${y}-11`, 2], [`${Number(y) - 1}-12`, 9]]);
    const r = await d.query<{ last_seq: number }>(
      'select last_seq from public.proposal_ref_counters where period = $1', [y]);
    expect(r.rows[0].last_seq).toBe(6);
    await d.exec(`insert into public.proposals (name) values ('a')`);
    const p = await d.query<{ ref_number: string }>('select ref_number from public.proposals');
    expect(p.rows[0].ref_number).toMatch(new RegExp(`^FT-${y}\\d{2}0007$`));
  });

  it('keeps counting across months and restarts on 1 January (SA time)', async () => {
    const d = await db();
    expect(await refAt(d, '2027-01-05T10:00:00+02:00')).toBe('FT-2027010001');
    expect(await refAt(d, '2027-01-31T21:59:00Z')).toBe('FT-2027010002'); // 23:59 SAST
    expect(await refAt(d, '2027-01-31T22:30:00Z')).toBe('FT-2027020003'); // 00:30 SAST, 1 Feb
    expect(await refAt(d, '2027-12-31T22:30:00Z')).toBe('FT-2028010001'); // new year in SA
    expect(await refAt(d, '2027-12-15T09:00:00+02:00')).toBe('FT-2027120004');
  });

  it('never truncates past 9 999 in a year', async () => {
    const d = await db();
    await d.query(`insert into public.proposal_ref_counters values ('2030', 9999)`);
    expect(await refAt(d, '2030-06-01T10:00:00+02:00')).toBe('FT-20300610000');
  });

  it('refuses to run twice', async () => {
    const d = await db();
    await expect(d.exec(m007)).rejects.toThrow(/007: a yearly counter row already exists/);
  });
});
