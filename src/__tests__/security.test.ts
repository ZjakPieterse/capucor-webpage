import { describe, it, expect, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { timingSafeEqual } from '@/lib/security';
import { verifyWebhookSignature } from '@/lib/paystack';

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

describe('verifyWebhookSignature (Paystack HMAC-SHA512)', () => {
  const SECRET = 'sk_test_webhook_secret';
  const BODY = JSON.stringify({ event: 'charge.success', data: { reference: 'ref_1' } });
  // Cross-check the Web Crypto implementation against node:crypto.
  const validSig = createHmac('sha512', SECRET).update(BODY).digest('hex');

  beforeEach(() => {
    process.env.PAYSTACK_SECRET_KEY = SECRET;
  });

  it('accepts a valid signature', async () => {
    expect(await verifyWebhookSignature(BODY, validSig)).toBe(true);
  });

  it('accepts an uppercase hex signature', async () => {
    expect(await verifyWebhookSignature(BODY, validSig.toUpperCase())).toBe(true);
  });

  it('rejects a tampered body', async () => {
    const tampered = BODY.replace('charge.success', 'charge.failure');
    expect(await verifyWebhookSignature(tampered, validSig)).toBe(false);
  });

  it('rejects a wrong signature', async () => {
    const wrong = createHmac('sha512', 'other-secret').update(BODY).digest('hex');
    expect(await verifyWebhookSignature(BODY, wrong)).toBe(false);
  });

  it('fails closed without a signature header', async () => {
    expect(await verifyWebhookSignature(BODY, null)).toBe(false);
    expect(await verifyWebhookSignature(BODY, '')).toBe(false);
  });

  it('fails closed without PAYSTACK_SECRET_KEY', async () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    expect(await verifyWebhookSignature(BODY, validSig)).toBe(false);
  });
});
