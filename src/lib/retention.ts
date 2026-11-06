/**
 * POPIA s14 retention: the daily prune job (/api/cron/prune-leads) deletes
 * personal information once its purpose has ended. Periods live in
 * lib/consent.ts and are stated on /privacy (privacy notice v3, Zjak
 * 2026-11-06).
 *
 *  - leads: enquiries still at status 'new' after LEAD_RETENTION_DAYS;
 *  - proposals: never signed, UNSIGNED_PROPOSAL_RETENTION_DAYS after expiry
 *    (or after creation for old rows with no expiry). Signed proposals are the
 *    contract and mandate, and are never touched here;
 *  - data_requests: after DATA_REQUEST_RETENTION_DAYS;
 *  - email_deliveries: finished sends after EMAIL_DELIVERY_RETENTION_DAYS,
 *    except those a signed proposal's fulfilment row points at.
 *
 * Each step runs on its own, so one failure does not stop the others.
 * Deletes go by id in small batches to keep request URLs short.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DATA_REQUEST_RETENTION_DAYS,
  EMAIL_DELIVERY_RETENTION_DAYS,
  LEAD_RETENTION_DAYS,
  UNSIGNED_PROPOSAL_RETENTION_DAYS,
} from '@/lib/consent';

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH = 100;
const SCAN_LIMIT = 1000;

// Statuses a proposal can hold without ever having been signed.
export const UNSIGNED_PROPOSAL_STATUSES = ['sent', 'viewed', 'expired', 'declined', 'superseded'] as const;
// Sends the retry runner has finished with.
export const FINISHED_DELIVERY_STATUSES = ['accepted', 'permanently_failed'] as const;

export interface UnsignedProposalRow {
  id: string;
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
  const from = row.expires_at ?? row.created_at;
  return new Date(from).getTime() < now.getTime() - UNSIGNED_PROPOSAL_RETENTION_DAYS * DAY_MS;
}

export interface StepResult {
  deleted: number;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

async function deleteByIds(supabase: AnyClient, table: string, ids: string[]): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .in('id', ids.slice(i, i + BATCH));
    if (error) throw error;
    deleted += count ?? 0;
  }
  return deleted;
}

async function pruneLeads(supabase: AnyClient, now: Date): Promise<number> {
  const { error, count } = await supabase
    .from('leads')
    .delete({ count: 'exact' })
    .eq('status', 'new')
    .lt('created_at', cutoffIso(now, LEAD_RETENTION_DAYS));
  if (error) throw error;
  return count ?? 0;
}

async function pruneUnsignedProposals(supabase: AnyClient, now: Date): Promise<number> {
  // A proposal expires after created_at, so created_at before the cutoff is a
  // safe database pre-filter; the exact rule is isPrunableProposal.
  const { data, error } = await supabase
    .from('proposals')
    .select('id, signed_at, expires_at, created_at')
    .is('signed_at', null)
    .in('status', [...UNSIGNED_PROPOSAL_STATUSES])
    .lt('created_at', cutoffIso(now, UNSIGNED_PROPOSAL_RETENTION_DAYS))
    .limit(SCAN_LIMIT);
  if (error) throw error;
  let ids = ((data ?? []) as UnsignedProposalRow[])
    .filter((row) => isPrunableProposal(row, now))
    .map((row) => row.id);
  if (ids.length === 0) return 0;

  // A plan review that sent a new proposal points at it (no ON DELETE rule);
  // keep those rows so the review history stays intact.
  const { data: refs, error: refErr } = await supabase
    .from('plan_reviews')
    .select('new_proposal_id')
    .in('new_proposal_id', ids);
  if (refErr) throw refErr;
  const kept = new Set((refs ?? []).map((r: { new_proposal_id: string | null }) => r.new_proposal_id));
  ids = ids.filter((id) => !kept.has(id));
  return deleteByIds(supabase, 'proposals', ids);
}

async function pruneDataRequests(supabase: AnyClient, now: Date): Promise<number> {
  const { error, count } = await supabase
    .from('data_requests')
    .delete({ count: 'exact' })
    .lt('created_at', cutoffIso(now, DATA_REQUEST_RETENTION_DAYS));
  if (error) throw error;
  return count ?? 0;
}

async function pruneEmailDeliveries(supabase: AnyClient, now: Date): Promise<number> {
  const { data, error } = await supabase
    .from('email_deliveries')
    .select('id')
    .in('status', [...FINISHED_DELIVERY_STATUSES])
    .lt('created_at', cutoffIso(now, EMAIL_DELIVERY_RETENTION_DAYS))
    .limit(SCAN_LIMIT);
  if (error) throw error;
  let ids = (data ?? []).map((r: { id: string }) => r.id);
  if (ids.length === 0) return 0;

  // Signed proposals keep the record of their "signed" emails (and the
  // foreign keys from proposal_fulfilment would block the delete anyway).
  const { data: refs, error: refErr } = await supabase
    .from('proposal_fulfilment')
    .select('client_email_delivery_id, owner_email_delivery_id');
  if (refErr) throw refErr;
  const kept = new Set<string>();
  for (const r of (refs ?? []) as { client_email_delivery_id: string | null; owner_email_delivery_id: string | null }[]) {
    if (r.client_email_delivery_id) kept.add(r.client_email_delivery_id);
    if (r.owner_email_delivery_id) kept.add(r.owner_email_delivery_id);
  }
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
      result[name] = { deleted: await step(supabase, now) };
    } catch (err) {
      result[name] = { deleted: 0, error: errorText(err) };
    }
  }
  return result;
}
