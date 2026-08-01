import { describe, it, expect } from 'vitest';
import { timingSafeEqual } from '@/lib/security';

describe('timingSafeEqual', () => {
  it('equal strings compare true', () => {
    expect(timingSafeEqual('secret-token-123', 'secret-token-123')).toBe(true);
  });

  it('same-length difference compares false', () => {
    expect(timingSafeEqual('secret-token-123', 'secret-token-124')).toBe(false);
  });

  it('different lengths compare false', () => {
    expect(timingSafeEqual('secret', 'secret-longer')).toBe(false);
    expect(timingSafeEqual('secret-longer', 'secret')).toBe(false);
  });

  it('empty strings compare true', () => {
    expect(timingSafeEqual('', '')).toBe(true);
  });

  it('handles multi-byte characters', () => {
    expect(timingSafeEqual('señal-α', 'señal-α')).toBe(true);
    expect(timingSafeEqual('señal-α', 'señal-β')).toBe(false);
  });
});
