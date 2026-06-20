import { describe, it, expect } from 'vitest';
import { getClientIp } from '@/lib/getClientIp';

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe('getClientIp', () => {
  it('prefers cf-connecting-ip over x-forwarded-for and x-real-ip', () => {
    const h = headers({
      'cf-connecting-ip': '198.51.100.7',
      'x-forwarded-for': '::1',
      'x-real-ip': '10.0.0.1',
    });
    expect(getClientIp(h)).toBe('198.51.100.7');
  });

  it('falls back to the first x-forwarded-for hop when no cf header', () => {
    const h = headers({ 'x-forwarded-for': '203.0.113.5, 70.41.3.18, ::1' });
    expect(getClientIp(h)).toBe('203.0.113.5');
  });

  it('trims whitespace around the chosen value', () => {
    expect(getClientIp(headers({ 'cf-connecting-ip': '  198.51.100.7  ' }))).toBe('198.51.100.7');
    expect(getClientIp(headers({ 'x-forwarded-for': ' 203.0.113.5 , 70.41.3.18 ' }))).toBe(
      '203.0.113.5',
    );
  });

  it('falls back to x-real-ip when neither cf nor forwarded-for is present', () => {
    expect(getClientIp(headers({ 'x-real-ip': '192.0.2.44' }))).toBe('192.0.2.44');
  });

  it('returns "unknown" when no IP headers are present', () => {
    expect(getClientIp(headers({}))).toBe('unknown');
  });

  it('skips an empty header value and falls through to the next source', () => {
    const h = headers({ 'cf-connecting-ip': '', 'x-forwarded-for': '203.0.113.5' });
    expect(getClientIp(h)).toBe('203.0.113.5');
  });

  it('is case-insensitive on header names (real Headers instance)', () => {
    const h = new Headers();
    h.set('CF-Connecting-IP', '198.51.100.7');
    expect(getClientIp(h)).toBe('198.51.100.7');
  });
});
