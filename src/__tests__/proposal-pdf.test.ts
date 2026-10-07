import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db';

// Anon client + pricing are stubbed; we exercise the archival orchestration
// (skip / POST / store), not the document content (covered separately).
const anonMock = {
  from: () => ({
    select: () => ({
      eq: () => ({ order: async () => ({ data: [], error: null }) }),
      order: async () => ({ data: [], error: null }),
    }),
  }),
};
vi.mock('@/lib/supabase/anon', () => ({
  createSupabaseAnonClient: vi.fn(() => anonMock),
}));
vi.mock('@/lib/proposalPricing', () => ({
  priceProposalSelection: vi.fn(async () => ({
    ok: true,
    data: {
      addonSlugs: [],
      lineItems: [{ name: 'Accounting', label: null, price: 1325 }],
      monthlyTotalZAR: 1325,
      vatZAR: 0,
      totalChargeZAR: 1325,
    },
  })),
}));

import { archiveSignedProposal } from '@/lib/portal/proposalPdf';
import { priceProposalSelection } from '@/lib/proposalPricing';
import { formatZAR } from '@/lib/utils';
import { signedProposalFilename } from '@/lib/portal/proposalPdfPayload';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function signedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prop_1',
    ref_number: 'FT-2026-06-0042',
    version: 1,
    first_name: 'Pat',
    last_name: 'Patterson',
    business_name: 'Pat Trading Co',
    services: ['accounting'],
    brackets: { accounting: 0 },
    tier_slug: 'pro',
    addons: [],
    total_charge_zar: 1325,
    sent_at: '2026-06-01',
    expires_at: '2026-07-01',
    signed_at: '2026-06-17',
    signature_name: 'Pat Patterson',
    signature_method: 'typed',
    signature_image: PNG,
    signature_ip: '203.0.113.1',
    proposal_pdf_drive_id: null,
    ...overrides,
  };
}

function makeAdmin(
  row: Record<string, unknown> | null,
  { updateError = null }: { updateError?: unknown } = {},
) {
  const updatePayloads: Record<string, unknown>[] = [];
  const bracketReads: string[] = [];
  const admin = {
    updatePayloads,
    bracketReads,
    from: (t: string) => {
      // Brackets come through the SERVICE ROLE (retired rows included).
      if (t === 'brackets') {
        bracketReads.push(t);
        return { select: () => ({ order: async () => ({ data: [], error: null }) }) };
      }
      if (t !== 'proposals') throw new Error(`unexpected table ${t}`);
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }),
        }),
        update: (payload: Record<string, unknown>) => {
          updatePayloads.push(payload);
          return { eq: async () => ({ error: updateError }) };
        },
      };
    },
  };
  return admin;
}

const asClient = (a: ReturnType<typeof makeAdmin>) =>
  a as unknown as SupabaseClient<Database>;

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APPS_SCRIPT_PDF_URL = 'https://script.example/exec';
  process.env.APPS_SCRIPT_PDF_SECRET = 'shh';
  fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      ok: true,
      fileId: 'file_1',
      fileUrl: 'https://drive/file_1',
    }),
  }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('archiveSignedProposal', () => {
  it('1. success — POSTs the document and stores the file id', async () => {
    const admin = makeAdmin(signedRow());
    const res = await archiveSignedProposal(asClient(admin), 'prop_1');

    expect(res).toMatchObject({ ok: true, fileId: 'file_1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(admin.updatePayloads[0]).toEqual({
      proposal_pdf_drive_id: 'file_1',
    });

    // Secret + filename travel in the POST body.
    const body = JSON.parse(
      (fetchMock.mock.calls[0]![1] as { body: string }).body,
    );
    expect(body.secret).toBe('shh');
    expect(body.proposalId).toBe('prop_1');
    // Decision 2026-10-07: signing date (SAST) - business - ref - signed proposal.
    expect(body.filename).toBe('2026-06-17 - Pat Trading Co - FT-2026-06-0042 - signed proposal.pdf');
    expect(typeof body.html).toBe('string');
    expect(
      (fetchMock.mock.calls[0]![1] as { signal: AbortSignal }).signal,
    ).toBeInstanceOf(AbortSignal);
  });

  it('2. already archived — skips (no POST, no update)', async () => {
    const admin = makeAdmin(
      signedRow({ proposal_pdf_drive_id: 'existing_file' }),
    );
    const res = await archiveSignedProposal(asClient(admin), 'prop_1');

    expect(res).toMatchObject({
      ok: true,
      skipped: true,
      fileId: 'existing_file',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(admin.updatePayloads).toHaveLength(0);
  });

  it('3. env unset — silently skips, no DB read or POST', async () => {
    delete process.env.APPS_SCRIPT_PDF_URL;
    const admin = makeAdmin(signedRow());
    const res = await archiveSignedProposal(asClient(admin), 'prop_1');

    expect(res).toMatchObject({ ok: false, skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('4. not signed — skips with an error, no POST', async () => {
    const admin = makeAdmin(signedRow({ signed_at: null }));
    const res = await archiveSignedProposal(asClient(admin), 'prop_1');

    expect(res.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('5. Apps Script non-200 — ok:false, no id stored', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    const admin = makeAdmin(signedRow());
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await archiveSignedProposal(asClient(admin), 'prop_1');

    expect(res.ok).toBe(false);
    expect(admin.updatePayloads).toHaveLength(0);
    errorSpy.mockRestore();
  });

  it('6. Apps Script returns ok:false — ok:false, no id stored', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: false, error: 'folder missing' }),
    });
    const admin = makeAdmin(signedRow());
    const res = await archiveSignedProposal(asClient(admin), 'prop_1');

    expect(res.ok).toBe(false);
    expect(admin.updatePayloads).toHaveLength(0);
  });

  it('7. unknown proposal — ok:false, no POST', async () => {
    const admin = makeAdmin(null);
    const res = await archiveSignedProposal(asClient(admin), 'nope');

    expect(res.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('8. Apps Script timeout is a recoverable archival failure', async () => {
    fetchMock.mockRejectedValueOnce(
      new DOMException('Timed out', 'TimeoutError'),
    );
    const admin = makeAdmin(signedRow());
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await archiveSignedProposal(asClient(admin), 'prop_1');

    expect(res).toMatchObject({ ok: false, error: 'Timed out' });
    expect(admin.updatePayloads).toHaveLength(0);
    errorSpy.mockRestore();
  });
});

describe('⚠️ a proposal priced on retired bracket rows (price-list change after sending)', () => {
  // The anon RLS policy returns active rows only, so an anon read dropped the
  // retired lines and re-priced the signed mandate lower than what was signed.
  it('reads brackets and prices with the service role, never anon', async () => {
    const admin = makeAdmin(signedRow());
    await archiveSignedProposal(asClient(admin), 'prop_1');
    expect(admin.bracketReads).toEqual(['brackets']);
    expect(vi.mocked(priceProposalSelection).mock.calls[0]![0]).toBe(admin);
  });

  it('states the SIGNED total on the PDF even when re-pricing disagrees', async () => {
    vi.mocked(priceProposalSelection).mockResolvedValueOnce({
      ok: true,
      data: {
        addonSlugs: [],
        lineItems: [{ slug: 'accounting', name: 'Accounting', label: null, price: 900 }],
        monthlyTotalZAR: 900,
        vatZAR: 0,
        totalChargeZAR: 900,
      },
    });
    const admin = makeAdmin(signedRow({ total_charge_zar: 1325 }));
    const res = await archiveSignedProposal(asClient(admin), 'prop_1');
    expect(res.ok).toBe(true);
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body);
    // The bold total cell is the signed figure, not the re-priced R 900.
    expect(body.html).toMatch(new RegExp(`font-weight:700[^>]*>${formatZAR(1325)}</td>`));
    expect(body.html).not.toMatch(new RegExp(`font-weight:700[^>]*>${formatZAR(900)}</td>`));
  });
});

describe('signedProposalFilename', () => {
  it('dates the file by the signing day in SAST, not UTC', () => {
    // 23:30 UTC on 30 Sept is 01:30 on 1 Oct in Johannesburg.
    expect(
      signedProposalFilename({
        signed_at: '2026-09-30T23:30:00Z',
        business_name: ' Pat Trading Co ',
        ref_number: 'FT-2026-09-0007',
      }),
    ).toBe('2026-10-01 - Pat Trading Co - FT-2026-09-0007 - signed proposal.pdf');
  });

  it('leaves out the ref segment for an older row without one', () => {
    expect(
      signedProposalFilename({ signed_at: '2026-10-07T08:00:00+00:00', business_name: 'Pat Trading Co', ref_number: null }),
    ).toBe('2026-10-07 - Pat Trading Co - signed proposal.pdf');
  });
});
