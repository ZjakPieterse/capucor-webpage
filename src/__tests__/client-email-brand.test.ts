// Brand v1.2 (Zjak, 2026-10-17): client emails carry the on-light logo, Capucor Navy (never the
// old teal), a single "Capucor Team" sign-off and a footer that names the business.
import { describe, expect, it } from 'vitest';
import {
  renderCreatedProposalClientEmail,
  renderSignConfirmEmail,
  renderSignedClientEmail,
} from '@/lib/email/messages.mjs';

const emails = {
  proposal: renderCreatedProposalClientEmail({
    firstName: 'Thandi', businessName: 'Example (Pty) Ltd', tierName: 'Pro', refNumber: 'FT-1',
    lineItems: [{ name: 'Pro package', price: 5750 }], totalChargeZAR: 5750,
    proposalUrl: 'https://capucor.com/proposal/x', firstDebitFrom: '2026-10-17T00:00:00Z',
  }),
  confirm: renderSignConfirmEmail({
    firstName: 'Thandi', businessName: 'Example (Pty) Ltd', refNumber: 'FT-1', confirmUrl: 'https://capucor.com/c',
  }),
  signed: renderSignedClientEmail({ firstName: 'Thandi', businessName: 'Example (Pty) Ltd', signedAt: '2026-10-17T08:00:00Z' }),
};

describe('client emails follow the brand', () => {
  for (const [name, html] of Object.entries(emails)) {
    it(`${name}: logo, navy, one team sign-off, business footer`, () => {
      expect(html).toContain('https://capucor.com/brand/capucor-logo-on-light.png');
      expect(html).toContain('#00175f');
      expect(html.toLowerCase()).not.toContain('#0f766e');
      expect(html.match(/Capucor Team/g)).toHaveLength(1);
      expect(html).toContain('Capucor Business Solutions · <a href="https://capucor.com"');
    });
  }
});
