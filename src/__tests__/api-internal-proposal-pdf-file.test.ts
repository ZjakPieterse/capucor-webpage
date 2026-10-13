import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock('@/lib/portal/proposalPdf', () => ({ fetchSignedProposalPdf: vi.fn() }));

import { fetchSignedProposalPdf } from '@/lib/portal/proposalPdf';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { POST } from '@/app/api/internal/proposal-fulfilment/pdf-file/route';

const PROPOSAL_ID = '11111111-1111-4111-8111-111111111111';
const SECRET = 'service-role-fixture-secret';

function sign(message: string) {
  return createHmac('sha256', SECRET).update(message).digest('hex');
}

function request(timestamp: string, signature: string) {
  return new NextRequest(
    'https://capucor.com/api/internal/proposal-fulfilment/pdf-file',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-capucor-timestamp': timestamp,
        'x-capucor-signature': signature,
      },
      body: JSON.stringify({ proposalId: PROPOSAL_ID }),
    },
  );
}

function admin(driveId: string | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { proposal_pdf_drive_id: driveId },
            error: null,
          }),
        }),
      }),
    }),
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_SERVICE_ROLE_KEY = SECRET;
  vi.mocked(createSupabaseAdminClient).mockReturnValue(admin('drive_1'));
  vi.mocked(fetchSignedProposalPdf).mockResolvedValue({
    ok: true,
    contentBase64: 'JVBERi0xLjQK',
  });
});

describe('POST internal signed-PDF read for the retry runner', () => {
  it('returns the archived PDF for a pdf-file signature', async () => {
    const ts = String(Date.now());
    const response = await POST(request(ts, sign(`${ts}.pdf-file.${PROPOSAL_ID}`)));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, contentBase64: 'JVBERi0xLjQK' });
    expect(fetchSignedProposalPdf).toHaveBeenCalledWith('drive_1');
  });

  it('refuses an archive-bridge signature', async () => {
    const ts = String(Date.now());
    const response = await POST(request(ts, sign(`${ts}.${PROPOSAL_ID}`)));
    expect(response.status).toBe(401);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it('answers 404 when nothing is archived yet', async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(admin(null));
    const ts = String(Date.now());
    const response = await POST(request(ts, sign(`${ts}.pdf-file.${PROPOSAL_ID}`)));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, code: 'pdf_not_archived' });
    expect(fetchSignedProposalPdf).not.toHaveBeenCalled();
  });

  it('passes a read failure through as a code', async () => {
    vi.mocked(fetchSignedProposalPdf).mockResolvedValueOnce({
      ok: false,
      code: 'pdf_fetch_timeout',
    });
    const ts = String(Date.now());
    const response = await POST(request(ts, sign(`${ts}.pdf-file.${PROPOSAL_ID}`)));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, code: 'pdf_fetch_timeout' });
  });
});
