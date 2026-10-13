/**
 * The retry runner's schedule and PDF bridge bounds (2026-10-13). A first PDF
 * archive timed out (FT-2026-10-0004) and the client's "That's signed" waited
 * on the hourly run; these pin the ten-minute business-hours tier and keep each
 * bridge above the Worker call it waits on.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  LEASE_MS,
  PDF_BRIDGE_TIMEOUT_MS,
  PDF_FILE_TIMEOUT_MS,
  archiveProposalPdf,
} from '../../scripts/reconcile-deliveries.mjs';
import {
  PDF_ARCHIVE_TIMEOUT_MS,
  PDF_FETCH_TIMEOUT_MS,
} from '@/lib/portal/proposalPdf';

const workflow = readFileSync(
  join(process.cwd(), '.github', 'workflows', 'cron-reconcile-deliveries.yml'),
  'utf8',
);
const crons = [...workflow.matchAll(/^\s*- cron: '([^']+)'/gm)].map((m) => m[1]);

describe('cron-reconcile-deliveries schedule', () => {
  it('runs every ten minutes in weekday business hours (08:00–18:00 SAST) and hourly otherwise', () => {
    expect(crons).toEqual(['5,15,25,35,45,55 6-15 * * 1-5', '0 * * * *']);
    expect(workflow).toMatch(/^\s+workflow_dispatch:/m);
  });

  it('the docs state the same schedule', () => {
    const seam = readFileSync(join(process.cwd(), 'docs', 'domain-seam.md'), 'utf8');
    const agents = readFileSync(join(process.cwd(), 'AGENTS.md'), 'utf8');
    expect(seam).toMatch(/every ten minutes in\s+weekday business hours/);
    expect(seam).not.toMatch(/retry runner \(`cron-reconcile-deliveries\.yml`, hourly/);
    expect(agents).toMatch(/retries \(every ten minutes in\s+weekday business hours, hourly otherwise\)/);
  });
});

describe('PDF bridge timeouts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('each bridge waits longer than the Worker call behind it, and less than the stage lease', () => {
    expect(PDF_BRIDGE_TIMEOUT_MS).toBeGreaterThanOrEqual(PDF_ARCHIVE_TIMEOUT_MS + 10_000);
    expect(PDF_FILE_TIMEOUT_MS).toBeGreaterThan(PDF_FETCH_TIMEOUT_MS);
    expect(PDF_BRIDGE_TIMEOUT_MS).toBeLessThan(LEASE_MS);
    expect(PDF_FILE_TIMEOUT_MS).toBeLessThan(LEASE_MS);
  });

  it('the archive bridge uses its own bound, not the 8 s provider one', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true, fileId: 'file_1' }), { status: 200 })),
    );
    const result = await archiveProposalPdf(
      { request: vi.fn(async () => []) },
      { id: '11111111-1111-4111-8111-111111111111', signed_at: '2026-10-13T11:11:48Z', proposal_pdf_drive_id: null },
      { serviceKey: 'service-key-for-tests', marketingUrl: 'https://capucor.com' },
    );
    expect(result).toMatchObject({ ok: true, fileId: 'file_1' });
    expect(timeout).toHaveBeenCalledWith(PDF_BRIDGE_TIMEOUT_MS);
  });
});
