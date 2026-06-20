import { describe, it, expect } from 'vitest';
import { maskEmail } from '@/lib/maskEmail';

describe('maskEmail', () => {
  it('keeps the first character and the full domain', () => {
    expect(maskEmail('jordan@acme.com')).toBe('j***@acme.com');
  });

  it('masks a single-character local part without leaking it', () => {
    expect(maskEmail('k@acme.com')).toBe('***@acme.com');
  });

  it('preserves subdomains in the domain', () => {
    expect(maskEmail('pat@mail.acme.co.za')).toBe('p***@mail.acme.co.za');
  });

  it('is defensive against a missing @', () => {
    expect(maskEmail('not-an-email')).toBe('***');
    expect(maskEmail('')).toBe('***');
  });
});
