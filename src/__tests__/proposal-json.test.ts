/**
 * The boundary that narrows `proposals.brackets` and `proposals.addons`.
 *
 * These two columns are `jsonb`, so the schema types them `Json` and Postgres
 * can hold anything in them. Until 2026-09-04 every read asserted a shape over
 * them with `as unknown as`, which also discarded the parse of the whole select
 * string. These functions replace that assertion with a real narrowing.
 *
 * ⚠️ THE VALUE-PRESERVING CASES ARE THE IMPORTANT ONES. This sits on the
 * proposal a client signs and the PDF archived against it, so a well-formed
 * bracket map must come through byte-for-byte. The discard cases matter too, but
 * a narrowing that quietly rewrites good data would be a billing bug.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { addonSlugsFromStored, bracketMapFromStored } from '@/lib/portal/proposalJson';

let warned: unknown[][];

beforeEach(() => {
  warned = [];
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    warned.push(args);
  });
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    warned.push(args);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('bracketMapFromStored', () => {
  it('passes a well-formed bracket map through unchanged', () => {
    const stored = { bookkeeping: 0, payroll: 3, tax: 12 };
    expect(bracketMapFromStored(stored, 'p1')).toEqual(stored);
    expect(warned).toEqual([]);
  });

  it('keeps zero, which is a real ordinal and not an absent value', () => {
    expect(bracketMapFromStored({ bookkeeping: 0 }, 'p1')).toEqual({ bookkeeping: 0 });
  });

  it('drops non-integer, negative and non-numeric entries, keeping the rest', () => {
    const kept = bracketMapFromStored(
      { good: 2, negative: -1, fractional: 1.5, text: 'three', nested: { a: 1 }, empty: null },
      'p1',
    );
    expect(kept).toEqual({ good: 2 });
    expect(warned.length).toBe(1);
  });

  it('returns an empty map for null, an array, a string and a number', () => {
    expect(bracketMapFromStored(null, 'p1')).toEqual({});
    expect(bracketMapFromStored([1, 2], 'p1')).toEqual({});
    expect(bracketMapFromStored('bookkeeping', 'p1')).toEqual({});
    expect(bracketMapFromStored(7, 'p1')).toEqual({});
  });

  it('says nothing for a stored null, and warns for every other unreadable shape', () => {
    bracketMapFromStored(null, 'p1');
    expect(warned).toEqual([]);

    bracketMapFromStored('bookkeeping', 'p2');
    expect(warned.length).toBe(1);
    expect(JSON.stringify(warned[0])).toContain('p2');
  });
});

describe('addonSlugsFromStored', () => {
  it('passes a well-formed slug list through unchanged', () => {
    expect(addonSlugsFromStored(['cipc', 'beneficial-ownership'], 'p1')).toEqual([
      'cipc',
      'beneficial-ownership',
    ]);
    expect(warned).toEqual([]);
  });

  it('treats null and undefined as no add-ons, without warning', () => {
    expect(addonSlugsFromStored(null, 'p1')).toEqual([]);
    expect(addonSlugsFromStored(undefined, 'p1')).toEqual([]);
    expect(warned).toEqual([]);
  });

  it('keeps the string members of a mixed array and warns about the loss', () => {
    expect(addonSlugsFromStored(['cipc', 7, null, 'vat'], 'p1')).toEqual(['cipc', 'vat']);
    expect(warned.length).toBe(1);
  });

  it('returns empty and warns when the column holds an object or a string', () => {
    expect(addonSlugsFromStored({ cipc: true }, 'p1')).toEqual([]);
    expect(addonSlugsFromStored('cipc', 'p2')).toEqual([]);
    expect(warned.length).toBe(2);
  });

  it('preserves order and duplicates rather than tidying them', () => {
    // De-duplication happens downstream in proposalPricing; doing it here too
    // would make two places responsible for one rule.
    expect(addonSlugsFromStored(['vat', 'cipc', 'vat'], 'p1')).toEqual(['vat', 'cipc', 'vat']);
  });
});
