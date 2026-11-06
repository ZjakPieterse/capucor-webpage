/**
 * POPIA s14 retention: the daily prune job (/api/cron/prune-leads) deletes
 * personal information once its purpose has ended. Periods live in
 * lib/consent.ts and are stated on /privacy (privacy notice v3, Zjak
 * 2026-11-06).
 *
 *  - leads: enquiries still at status 'new' after LEAD_RETENTION_DAYS;
 *  - proposals: never signed, UNSIGNED_PROPOSAL_RETENTION_DAYS after expiry.
 *    Signed proposals are the contract and mandate, and are never touched
 *    here. Proposals a plan review points at (as the plan reviewed or the
 *    proposal it sent) are kept with the client's review history; /privacy
 *    says so;
 *  - data_requests: after DATA_REQUEST_RETENTION_DAYS;
 *  - email_deliveries: this site's own finished sends (lead, proposal,
 *    data_request) after EMAIL_DELIVERY_RETENTION_DAYS, except those a signed
 *    proposal's fulfilment row points at. The portal (capucor-app) writes to
 *    the same table, and its rows are never touched here.
 *
 * Each step runs on its own, so one failure does not stop the others. Every
 * id lookup and delete goes in batches of BATCH ids to keep request URLs
 * short. A batch a foreign key blocks (23503) falls back to one id at a time,
 * so a single blocked row is skipped and reported instead of failing the job
 * every day.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DATA_REQUEST_RETENTION_DAYS,
  EMAIL_DELIVERY_RETENTION_DAYS,
  LEAD_RETENTION_DAYS,
  UNSIGNED_PROPOSAL_RETENTION_DAYS,
} from '@/lib/consent';

const DAY_MS = 24 * 60 * 60 * 1000;
export const BATCH = 100;
const SCAN_LIMIT = 1000;
const FK_VIOLATION = '23503';

// Statuses a proposal can hold without ever having been signed.
export const UNSIGNED_PROPOSAL_STATUSES = ['sent', 'viewed', 'expired', 'declined', 'superseded'] as const;
// Sends the retry runner has finished with.
export const FINISHED_DELIVERY_STATUSES = ['accepted', 'permanently_failed'] as const;
// email_deliveries.source_type values this site writes (sendEmail callers).
export const FUNNEL_EMAIL_SOURCE_TYPES = ['lead', 'proposal', 'data_request'] as const;

export interface UnsignedProposalRow {
  id: string;
  status: string;
  signed_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export function cutoffIso(now: Date, days: number): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}

/** True when an unsigned proposal is past its retention period. */
export function isPrunableProposal(row: UnsignedProposalRow, now: Date): boolean {
  if (row.signed_at) return false;
  // An old row with no expiry is still signable while sent or viewed (the
  // sign route treats a null expiry as open): never prune it.
  if (!row.expires_at && (row.status === 'sent' || row.status === 'viewed')) return false;
  const from = row.expires_at ?? row.created_at;
  return new Date(from).getTime() < now.getTime() - UNSIGNED_PROPOSAL_RETENTION_DAYS * DAY_MS;
}

export interface StepResult {
  deleted: number;
  // Rows a foreign key blocked; they are left in place and reported.
  skipped?: number;
  error?: string;
}

export interface RetentionResult {
  leads: StepResult;
  proposals: StepResult;
  data_requests: StepResult;
  email_deliveries: StepResult;
}

function errorText(err: unknown): string {
  const e = (err ?? {}) as { code?: unknown; message?: unknown };
  return `${e.code ?? 'error'}: ${e.message ?? String(err)}`;
}

function errorCode(err: unknown): string | undefined {
  return (err as { code?: string } | null)?.code;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

function batches<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += BATCH) out.push(items.slice(i, i + BATCH));
  return out;
}

async function deleteByIds(supabase: AnyClient, table: string, ids: string[]): Promise<StepResult> {
  let deleted = 0;
  let skipped = 0;
  for (const batch of batches(ids)) {
    const { error, count } = await supabase.from(table).delete({ count: 'exact' }).in('id', batch);
    if (!error) {
      deleted += count ?? 0;
      continue;
    }
    if (errorCode(error) !== FK_VIOLATION) throw error;
    for (const id of batch) {
      const one = await supabase.from(table).delete({ count: 'exact' }).eq('id', id);
      if (!one.error) deleted += one.count ?? 0;
      else if (errorCode(one.error) === FK_VIOLATION) skipped += 1;
      else throw one.error;
    }
  }
  return skipped ? { deleted, skipped } : { deleted };
}

/** The values of `column` in `table` that match `ids`, looked up in batches. */
async function referenced(
  supabase: AnyClient,
  table: string,
  column: string,
  ids: string[],
): Promise<Set<string>> {
  const found = new Set<string>();
  for (const batch of batches(ids)) {
    const { data, error } = await supabase.from(table).select(column).in(column, batch);
    if (error) throw error;
    // The column name is dynamic, so there is no parsed row shape to keep:
    // read the single selected value and check its type at runtime.
    for (const row of data ?? []) {
      const value: unknown = Object.values(row as object)[0];
      if (typeof value === 'string' && value) found.add(value);
    }
  }
  return found;
}

async function pruneLeads(supabase: AnyClient, now: Date): Promise<StepResult> {
  const { error, count } = await supabase
    .from('leads')
    .delete({ count: 'exact' })
    .eq('status', 'new')
    .lt('created_at', cutoffIso(now, LEAD_RETENTION_DAYS));
  if (error) throw error;
  return { deleted: count ?? 0 };
}

async function pruneUnsignedProposals(supabase: AnyClient, now: Date): Promise<StepResult> {
  // A proposal expires after created_at, so created_at before the cutoff is a
  // safe database pre-filter; the exact rule is isPrunableProposal.
  const { data, error } = await supabase
    .from('proposals')
    .select('id, status, signed_at, expires_at, created_at')
    .is('signed_at', null)
    .in('status', [...UNSIGNED_PROPOSAL_STATUSES])
    .lt('created_at', cutoffIso(now, UNSIGNED_PROPOSAL_RETENTION_DAYS))
    .order('created_at', { ascending: true })
    .limit(SCAN_LIMIT);
  if (error) throw error;
  let ids = ((data ?? []) as UnsignedProposalRow[])
    .filter((row) => isPrunableProposal(row, now))
    .map((row) => row.id);
  if (ids.length === 0) return { deleted: 0 };

  // plan_reviews points at proposals twice (no ON DELETE rule): keep those
  // rows with the client's review history.
  const kept = new Set([
    ...(await referenced(supabase, 'plan_reviews', 'proposal_id', ids)),
    ...(await referenced(supabase, 'plan_reviews', 'new_proposal_id', ids)),
  ]);
  ids = ids.filter((id) => !kept.has(id));
  return deleteByIds(supabase, 'proposals', ids);
}

async function pruneDataRequests(supabase: AnyClient, now: Date): Promise<StepResult> {
  const { error, count } = await supabase
    .from('data_requests')
    .delete({ count: 'exact' })
    .lt('created_at', cutoffIso(now, DATA_REQUEST_RETENTION_DAYS));
  if (error) throw error;
  return { deleted: count ?? 0 };
}

async function pruneEmailDeliveries(supabase: AnyClient, now: Date): Promise<StepResult> {
  const { data, error } = await supabase
    .from('email_deliveries')
    .select('id')
    .in('source_type', [...FUNNEL_EMAIL_SOURCE_TYPES])
    .in('status', [...FINISHED_DELIVERY_STATUSES])
    .lt('created_at', cutoffIso(now, EMAIL_DELIVERY_RETENTION_DAYS))
    .order('created_at', { ascending: true })
    .limit(SCAN_LIMIT);
  if (error) throw error;
  let ids = (data ?? []).map((r: { id: string }) => r.id);
  if (ids.length === 0) return { deleted: 0 };

  // Signed proposals keep the record of their "signed" emails (and the
  // foreign keys from proposal_fulfilment would block the delete anyway).
  const kept = new Set([
    ...(await referenced(supabase, 'proposal_fulfilment', 'client_email_delivery_id', ids)),
    ...(await referenced(supabase, 'proposal_fulfilment', 'owner_email_delivery_id', ids)),
  ]);
  ids = ids.filter((id) => !kept.has(id));
  return deleteByIds(supabase, 'email_deliveries', ids);
}

export async function runRetention(supabase: AnyClient, now = new Date()): Promise<RetentionResult> {
  const steps = {
    leads: pruneLeads,
    proposals: pruneUnsignedProposals,
    data_requests: pruneDataRequests,
    email_deliveries: pruneEmailDeliveries,
  } as const;
  const result = {} as RetentionResult;
  for (const [name, step] of Object.entries(steps) as [keyof RetentionResult, typeof pruneLeads][]) {
    try {
      result[name] = await step(supabase, now);
    } catch (err) {
      result[name] = { deleted: 0, error: errorText(err) };
    }
  }
  return result;
}
