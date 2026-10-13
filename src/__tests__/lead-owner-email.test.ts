import { describe, expect, it } from 'vitest';
import { buildLeadOwnerEmail } from '@/lib/email/messages.mjs';

// The /contact owner notification (Zjak, 2026-10-13): plain text in the same
// shape as the calculator's "New proposal" owner email.
const contact = (nextStep?: string, message?: string) => ({
  source: 'contact',
  name: 'Thandi Nkosi',
  email: 'thandi@example.co.za',
  business: 'Nkosi Trading',
  message,
  config: {
    turnover: 'Under R1m',
    teamSize: '2 to 5',
    booksNow: 'Nobody at the moment',
    services: ['Bookkeeping and Xero', 'Payroll'],
    ...(nextStep && { nextStep }),
  },
});

describe('owner email for a /contact lead', () => {
  it('leads the subject with the next step, then who and revenue', () => {
    expect(buildLeadOwnerEmail(contact('meeting')).subject).toBe(
      '📅 Fit call: Thandi Nkosi, Nkosi Trading (Under R1m)',
    );
    expect(buildLeadOwnerEmail(contact('message')).subject).toBe(
      '✉️ Message: Thandi Nkosi, Nkosi Trading (Under R1m)',
    );
    // Sent before the two-button form: no next step recorded.
    expect(buildLeadOwnerEmail(contact()).subject).toMatch(/^📝 Enquiry: /);
  });

  it('lists the answers as labelled lines, not JSON, and replies go to the lead', () => {
    const email = buildLeadOwnerEmail(contact('meeting', 'SARS keeps calling'));
    expect(email.replyTo).toBe('thandi@example.co.za');
    expect(email).not.toHaveProperty('html');
    expect(email.text).toBe(
      [
        'A new enquiry came in from the contact page.',
        '',
        'Next step: Wants a fit call (check your calendar)',
        'Name: Thandi Nkosi',
        'Business: Nkosi Trading',
        'Email: thandi@example.co.za',
        'Annual revenue: Under R1m',
        'Team size: 2 to 5',
        'Books now: Nobody at the moment',
        'Needs:',
        '  · Bookkeeping and Xero',
        '  · Payroll',
        '',
        'Message:',
        'SARS keeps calling',
        '',
        'Reply to this email to answer Thandi.',
      ].join('\n'),
    );
  });
});

describe('owner email for other leads is unchanged', () => {
  it('keeps the plain dump and the old subject', () => {
    const email = buildLeadOwnerEmail({
      source: 'quote',
      name: 'A B',
      email: 'a@b.co',
      config: { tier: 'core' },
    });
    expect(email.subject).toBe('New lead: A B (quote)');
    expect(email.text).toMatch(/Config:/);
    expect(email).not.toHaveProperty('replyTo');
  });
});
