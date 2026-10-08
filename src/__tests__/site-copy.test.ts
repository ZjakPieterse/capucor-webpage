import { describe, expect, it } from 'vitest';
import { readSource } from './helpers/sourceText';
import { AFTER_YOU_SIGN, PREMIUM_REQUEST_COPY, PRICING_TRUST_ITEMS } from '@/config/calculatorCopy';
import { siteConfig } from '@/config/site';

// Functionality batch 1 (Zjak, 2026-10-08): no promises Capucor cannot yet keep,
// no overage rates, and the per-package rhythm stated truthfully. These read
// source as text (LF-normalised by readSource, so negative checks are real).
const src = (path: string) => readSource('src', path);

describe('no unkept promises (F10, N13, F19, F22)', () => {
  it('quotes no reply time on the contact form or the Premium request', () => {
    expect(src('components/landing/ContactForm.tsx')).not.toMatch(/working\s+day/);
    expect(Object.values(PREMIUM_REQUEST_COPY).join(' ')).not.toMatch(/business day/);
  });

  it('makes the service-page deadlines conditional on the client', () => {
    expect(src('app/(site)/accounting/page.tsx')).not.toMatch(/No late-filing penalties/);
    expect(src('app/(site)/payroll/page.tsx')).not.toMatch(/before pay day/);
  });

  it('keeps the owner in the numbers', () => {
    expect(src('components/landing/ProblemCards.tsx')).not.toMatch(/runs without you/);
  });
});

describe('overage rates are not quoted (Zjak, 2026-10-08)', () => {
  it('leaves them out of the calculator review step', () => {
    const review = src('components/pricing/ReviewStep.tsx');
    expect(review).not.toMatch(/R ?200|R ?75|trued up/);
    expect(review).toContain('ALLOWANCE_CHANGE_NOTE');
    expect(review).toMatch(/Catch-up for the 3 months before you accept is included/);
  });
});

describe('the package rhythm is true for every package (F04, F20)', () => {
  it('promises no monthly report or real-time numbers to everyone', () => {
    expect(src('components/landing/HowItWorks.tsx')).not.toMatch(/clear monthly report|concise monthly view/);
    expect(src('components/landing/SwitchingSection.tsx')).not.toMatch(/with a report and a conversation/);
    expect(src('components/landing/ServicePillars.tsx')).not.toMatch(/real-time/);
  });

  it('names the real collection channels, not a portal (F21)', () => {
    const how = src('components/landing/HowItWorks.tsx');
    expect(how).not.toMatch(/one structured place/);
    expect(how).toMatch(/bank feeds/);
    expect(how).toMatch(/Dext on Pro and Premium/);
  });
});

describe('funnel copy (F13, F14, F25)', () => {
  it('has a de-duplicated, sentence-case trust bar', () => {
    const text = PRICING_TRUST_ITEMS.join(' ').toLowerCase();
    expect(text.match(/notice/g)?.length).toBe(1);
    for (const item of PRICING_TRUST_ITEMS) {
      const words = item.split(/\s+/).slice(1);
      expect(words.some((w) => /^[A-Z][a-z]/.test(w)), item).toBe(false);
    }
  });

  it('says what happens after signing, without timelines', () => {
    expect(AFTER_YOU_SIGN.join(' ')).toMatch(/debit order/);
    expect(AFTER_YOU_SIGN.join(' ')).not.toMatch(/\d|day|hour|week/);
  });

  it('says what the fit call is beside every "Book a fit call"', () => {
    expect(siteConfig.fitCallNote).toMatch(/free 30-minute call with Zjak/);
    for (const file of [
      'components/landing/HeroSection.tsx',
      'components/landing/FinalCTA.tsx',
      'components/landing/SwitchingSection.tsx',
      'components/services/ServiceCtaPair.tsx',
      'components/pricing/PricingErrorBoundary.tsx',
      'app/not-found.tsx',
      'app/error.tsx',
    ]) {
      const s = src(file);
      if (/Book a fit call/.test(s)) expect(s, file).toMatch(/FitCallNote/);
    }
  });
});

describe('navigation (F01, F02)', () => {
  it('links the three service pages from the nav and footer', () => {
    const hrefs = siteConfig.nav.map((n) => n.href);
    for (const p of ['/accounting', '/bookkeeping', '/payroll']) expect(hrefs).toContain(p);
    expect(src('components/layout/Footer.tsx')).not.toMatch(/\/#services/);
  });

  it('makes /pricing the header button and the portal a plain link', () => {
    const nav = src('components/layout/Navbar.tsx');
    expect(nav).toMatch(/href="\/pricing"/);
    expect(nav).not.toMatch(/render=\{<Link href=\{`\$\{siteConfig\.appUrl\}/);
  });
});
