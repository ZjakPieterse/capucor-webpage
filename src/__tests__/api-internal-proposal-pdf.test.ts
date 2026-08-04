import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock('@/lib/portal/proposalPdf', () => ({ archiveSignedProposal: vi.fn() }));

import { archiveSignedProposal } from '@/lib/portal/proposalPdf';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { POST } from '@/app/api/internal/proposal-fulfilment/pdf/route';

const PROPOSAL_ID = '11111111-1111-4111-8111-111111111111';
const SECRET = 'service-role-fixture-secret';

function request(
  proposalId = PROPOSAL_ID,
  timestamp = String(Date.now()),
  signature = createHmac('sha256', SECRET)
    .update(`${timestamp}.${proposalId}`)
    .digest('hex'),
) {
  return new NextRequest(
    'https://capucor.com/api/internal/proposal-fulfilment/pdf',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-capucor-timestamp': timestamp,
        'x-capucor-signature': signature,
      },
      body: JSON.stringify({ proposalId }),
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
  vi.mocked(createSupabaseAdminClient).mockReturnValue({} as never);
  vi.mocked(archiveSignedProposal).mockResolvedValue({
    ok: true,
    fileId: 'drive_file_1',
  });
});

describe('POST internal proposal PDF reconciliation', () => {
  it('accepts a fresh HMAC and invokes the existing idempotent archiver', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      fileId: 'drive_file_1',
    });
    expect(archiveSignedProposal).toHaveBeenCalledWith(
      expect.anything(),
      PROPOSAL_ID,
    );
  });

  it('rejects an invalid signature before creating an admin client', async () => {
    const response = await POST(
      request(PROPOSAL_ID, String(Date.now()), '0'.repeat(64)),
    );
    expect(response.status).toBe(401);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it('rejects a replay outside the five-minute window', async () => {
    const stale = String(Date.now() - 6 * 60_000);
    const response = await POST(request(PROPOSAL_ID, stale));
    expect(response.status).toBe(401);
    expect(archiveSignedProposal).not.toHaveBeenCalled();
  });

  it('rejects malformed proposal ids before authentication', async () => {
    const response = await POST(request('not-a-uuid'));
    expect(response.status).toBe(400);
    expect(archiveSignedProposal).not.toHaveBeenCalled();
  });

  it('returns a retryable provider failure without exposing credentials', async () => {
    vi.mocked(archiveSignedProposal).mockResolvedValueOnce({
      ok: false,
      error: 'Apps Script responded 503',
    });
    const response = await POST(request());
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({ ok: false });
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });
});
