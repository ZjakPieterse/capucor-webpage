import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// Anon client + pricing are stubbed; we exercise the archival orchestration
// (skip / POST / store), not the document content (covered separately).
const anonMock = {
  from: () => ({
    select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }),
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

function makeAdmin(row: Record<string, unknown> | null, { updateError = null }: { updateError?: unknown } = {}) {
  const updatePayloads: Record<string, unknown>[] = [];
  const admin = {
    updatePayloads,
    from: (t: string) => {
      if (t !== 'proposals') throw new Error(`unexpected table ${t}`);
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
        update: (payload: Record<string, unknown>) => {
          updatePayloads.push(payload);
          return { eq: async () => ({ error: updateError }) };
        },
      };
    },
  };
  return admin;
}

const asClient = (a: ReturnType<typeof makeAdmin>) => a as unknown as SupabaseClient;

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APPS_SCRIPT_PDF_URL = 'https://script.example/exec';
  process.env.APPS_SCRIPT_PDF_SECRET = 'shh';
  fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, fileId: 'file_1', fileUrl: 'https://drive/file_1' }),
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
    expect(admin.updatePayloads[0]).toEqual({ proposal_pdf_drive_id: 'file_1' });

    // Secret + filename travel in the POST body.
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body);
    expect(body.secret).toBe('shh');
    expect(body.filename).toContain('FT-2026-06-0042');
    expect(body.filename).toContain('Pat Trading Co');
    expect(typeof body.html).toBe('string');
  });

  it('2. already archived — skips (no POST, no update)', async () => {
    const admin = makeAdmin(signedRow({ proposal_pdf_drive_id: 'existing_file' }));
    const res = await archiveSignedProposal(asClient(admin), 'prop_1');

    expect(res).toMatchObject({ ok: true, skipped: true, fileId: 'existing_file' });
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
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
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
});
