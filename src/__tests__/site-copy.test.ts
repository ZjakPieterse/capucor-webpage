import { describe, expect, it } from 'vitest';
import { readSource } from './helpers/sourceText';
import { AFTER_YOU_SIGN, PREMIUM_REQUEST_COPY, PRICING_TRUST_ITEMS } from '@/config/calculatorCopy';
import { siteConfig } from '@/config/site';
import { ACCOUNTING, SERVICE_PAGES } from '@/config/servicePages';

// Functionality batch 1 (Zjak, 2026-10-08): no promises Capucor cannot yet keep,
// no overage rates, and the per-package rhythm stated truthfully. These read
// source as text (LF-normalised by readSource, so negative checks are real).
const src = (path: string) => readSource('src', path);

describe('no unkept promises (F10, N13, F19, F22)', () => {
  it('quotes no reply time on the contact form or the Premium request', () => {
    expect(src('components/contact/ContactForm.tsx')).not.toMatch(/working\s+day/);
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
    expect(src('components/landing/FirstNinetyDays.tsx')).not.toMatch(/with a report and a conversation/);
    expect(src('components/landing/ServicePillars.tsx')).not.toMatch(/real-time/);
  });

  it('names the real collection channels, not a portal (F21)', () => {
    const how = src('components/landing/HowItWorks.tsx');
    expect(how).not.toMatch(/one structured place/);
    expect(how).toMatch(/bank feeds/);
  });
});

describe('review step and proposal fallbacks (design review F3, G3, 2026-10-25)', () => {
  it('names what each review button does, and the modal echoes it', () => {
    const review = src('components/pricing/ReviewStep.tsx');
    expect(review).toContain('Accept and sign');
    expect(review).toContain('Email me the proposal');
    expect(review).not.toMatch(/Send proposal|^\s*Accept\s*$/m);
    expect(src('components/pricing/ActivateProposalModal.tsx')).toContain("'Email me the proposal'");
  });

  it('puts the actions before the inclusions list and drops the no-payment line (Zjak, 2026-10-25)', () => {
    const review = src('components/pricing/ReviewStep.tsx');
    const actions = review.indexOf('{byApplication ? (');
    const inclusions = review.indexOf('{inclusions && (');
    expect(actions).toBeGreaterThan(-1);
    expect(inclusions).toBeGreaterThan(actions);
    expect(inclusions).toBeLessThan(review.indexOf('What happens next'));
    expect(review).not.toMatch(/no payment/i);
  });

  it('gives an unavailable proposal a second route: a fit call or an email', () => {
    const page = src('app/proposal/[token]/page.tsx');
    expect(page).toMatch(/links.fitCall/);
    expect(page).toMatch(/email.contact/);
  });
});

describe('the proposal reads as a light document (design review G2, Zjak 2026-10-25)', () => {
  it('sets the document card on the paper palette with the light logo', () => {
    expect(src('app/proposal/[token]/page.tsx')).toMatch(/document-paper/);
    const sections = src('components/proposal/ProposalSections.tsx');
    expect(sections).toContain('capucor-logo-on-light.png');
    expect(sections).not.toMatch(/hover:/);
    expect(src('app/globals.css')).toContain('.document-paper {');
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

  // Decision 2026-10-08: the booking page explains the fit call (it will scale
  // with the team), and customer-facing copy speaks as a team, never one name.
  it('"Book a fit call" carries no duration or personal name, and no copy names Zjak', () => {
    for (const file of [
      'components/layout/Navbar.tsx',
      'components/landing/HeroSection.tsx',
      'components/landing/FinalCTA.tsx',
      'components/landing/FirstNinetyDays.tsx',
      'components/services/ServiceCtaPair.tsx',
      'components/pricing/PricingCalculator.tsx',
      'components/pricing/PricingErrorBoundary.tsx',
      'components/proposal/ProposalSignForm.tsx',
      'components/proposal/ConfirmSignButton.tsx',
      'app/proposal/[token]/page.tsx',
      'app/proposal/confirm/[ctoken]/page.tsx',
      'app/not-found.tsx',
      'app/error.tsx',
      'config/calculatorCopy.ts',
      'config/site.ts',
    ]) {
      // Comments may credit decisions to Zjak; rendered strings may not.
      const code = src(file)
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(code, file).not.toMatch(/Zjak|30-minute/);
    }
  });

  // The one exception (Zjak, 2026-10-18): the homepage "Meet the founder"
  // section names him, so visitors meet a real person. It stays the only one.
  it('names the founder only in the Meet the founder section', () => {
    const founder = src('components/landing/FounderTeam.tsx');
    expect(founder).toContain('Meet the founder');
    expect(founder).toMatch(/name: "Zjak Pieterse"/);
    expect(src('app/(site)/page.tsx')).not.toMatch(/Zjak/);
  });

  it('the header shows Home, Pricing and Contact only', () => {
    expect(siteConfig.nav.map((n) => n.label)).toEqual(['Home', 'Pricing', 'Contact']);
  });
});

describe('navigation (decision 2026-10-08)', () => {
  it('the footer links the three service pages', () => {
    expect(src('components/layout/Footer.tsx')).not.toMatch(/\/#services/);
  });

  it('the header button books a fit call, and there is no Client Portal link', () => {
    const nav = src('components/layout/Navbar.tsx');
    expect(nav).toMatch(/siteConfig.links.fitCall/);
    expect(nav).toMatch(/Book a fit call/);
    expect(nav).not.toMatch(/Client Portal|appUrl/);
  });
});

describe('services section (Zjak, 2026-10-10)', () => {
  it('keeps the heading and tells stories with a Read more button per card', () => {
    const pillars = src('components/landing/ServicePillars.tsx');
    expect(pillars).toContain('Three disciplines. One subscription.');
    expect(pillars).not.toMatch(/View \w+ support|Your own login|Included in your price/);
    expect(pillars).toMatch(/Read more/);
    expect(pillars).toContain('SERVICE_PAGES');
  });

  // Zjak, 2026-10-11: Accounting, Bookkeeping, Payroll; four items per card,
  // and each item is a card under that page's "What's included".
  it('orders the cards and ties each service page to its card', () => {
    expect(SERVICE_PAGES.map((s) => s.slug)).toEqual(['accounting', 'bookkeeping', 'payroll']);
    expect(ACCOUNTING.hook).toBe('Compliance, covered.');
    for (const svc of SERVICE_PAGES) {
      expect(svc.items, svc.slug).toHaveLength(4);
      expect(svc.href).toBe(`/${svc.slug}`);
      const page = src(`app/(site)/${svc.slug}/page.tsx`);
      expect(page, svc.slug).toContain(`<ServiceIncluded items={${svc.slug.toUpperCase()}.items} />`);
      expect(page, svc.slug).not.toMatch(/const INCLUDED|OTHER_SERVICES/);
      expect(page, svc.slug).toContain(`<ServiceConnects current="${svc.slug}" />`);
    }
  });

  it('shows no packages on the homepage; the calculator carries them', () => {
    expect(src('app/(site)/page.tsx')).not.toMatch(/PackagesTeaser/);
  });
});

describe('your first 90 days (interview 2026-10-12)', () => {
  const roadmap = () =>
    src('components/landing/FirstNinetyDays.tsx').replace(/^\s*\/\/.*$/gm, '');

  it('names no package, rhythm, amount, response time or bank feeds', () => {
    expect(roadmap()).not.toMatch(/Basic|Premium|\bPro\b|weekly|daily|same.day|R ?\d|bank feed/);
  });

  // The owner's part is told at every stage, not saved for the end, and the
  // card, the printable page and the welcome checklist share one list.
  it('tells the owner their part at each stage, from one checklist', () => {
    expect(roadmap().match(/yours: "/g)).toHaveLength(3);
    expect(roadmap()).toMatch(/ONBOARDING_CHECKLIST\.map/);
    expect(src('app/(site)/resources/onboarding-checklist/page.tsx')).toMatch(/ONBOARDING_CHECKLIST/);
    expect(src('config/onboardingChecklist.ts').replace(/^\s*\/\/.*$/gm, '')).not.toMatch(/bank feed|logins/i);
  });

  it('runs catch-up alongside the rhythm, with the 3 included months', () => {
    expect(roadmap()).toMatch(/The 3 months before you signed are included/);
    expect(roadmap()).toMatch(/alongside/);
  });

  // The software is billed to Capucor and eFiling sits on the practice profile,
  // so the honest claim is a handover of records, not the client's own logins.
  it('never claims the logins are the client\'s', () => {
    expect(roadmap()).not.toMatch(/logins/i);
    expect(SERVICE_PAGES.flatMap((p) => p.items.map((i) => i.description)).join(' ')).not.toMatch(/logins/i);
  });
});

describe('fit call goes through /contact first (Zjak, 2026-10-12)', () => {
  it('the calendar link appears only on /contact, after sending, and in the signing document', () => {
    const files = [
      'components/layout/Navbar.tsx',
      'components/landing/HeroSection.tsx',
      'components/landing/FinalCTA.tsx',
      'components/landing/FirstNinetyDays.tsx',
      'components/services/ServiceCtaPair.tsx',
      'components/pricing/PricingCalculator.tsx',
      'components/pricing/PricingErrorBoundary.tsx',
      'app/not-found.tsx',
      'app/error.tsx',
    ];
    for (const file of files) {
      expect(src(file), file).not.toMatch(/links\.booking/);
      expect(src(file), file).toMatch(/links\.fitCall/);
    }
    // The package step has no call link since every band is self-serve
    // (audit decision 1, 2026-10-13); it must not grow a calendar link either.
    expect(src('components/pricing/Step2Tiers.tsx')).not.toMatch(/links\.booking/);
    expect(siteConfig.links.fitCall).toBe('/contact');
    const form = src('components/contact/ContactForm.tsx');
    // The booking link is used only once the lead is saved (after the `!res.ok`
    // throw), never in the form itself.
    const uses = [...form.matchAll(/links\.booking/g)].map((m) => m.index!);
    expect(uses.length).toBeGreaterThan(0);
    for (const at of uses) {
      expect(at).toBeGreaterThan(form.indexOf('if (!res.ok)'));
      expect(at).toBeLessThan(form.indexOf('<form'));
    }
  });

  it('the homepage no longer carries the contact section', () => {
    expect(src('app/(site)/page.tsx')).not.toMatch(/ContactSection/);
  });
});

describe('contact form layout (Zjak, 2026-10-12)', () => {
  it('asks turnover, team size and books as dropdowns, then the services checklist', async () => {
    const { CONTACT_QUESTIONS } = await import('@/config/contactQuestions');
    expect(Object.keys(CONTACT_QUESTIONS)).toEqual(['turnover', 'teamSize', 'booksNow', 'services']);
    const form = src('components/contact/ContactForm.tsx');
    expect(form).toMatch(/\['turnover', 'teamSize', 'booksNow'\] as const\)\.map/);
    expect(form).toMatch(/<SelectField/);
    expect(form).toMatch(/<ServiceChecklist/);
    expect(form).not.toMatch(/mainReason|choice-chip/);
    expect(src('app/(site)/contact/page.tsx')).toMatch(/Let&apos;s get in touch/);
  });
});

describe('contact form tweaks (Zjak, 2026-10-13; sentence case and button per the full-site audit)', () => {
  it('no section titles or phone field, renamed dropdowns, two send buttons', async () => {
    const { CONTACT_QUESTIONS } = await import('@/config/contactQuestions');
    expect(CONTACT_QUESTIONS.turnover.label).toBe('Annual revenue');
    expect(CONTACT_QUESTIONS.teamSize.label).toBe('Team size');
    for (const key of ['turnover', 'teamSize', 'booksNow'] as const) {
      expect(CONTACT_QUESTIONS[key].placeholder).toBe('Choose an option');
    }
    expect(CONTACT_QUESTIONS.services).not.toHaveProperty('hint');
    const form = src('components/contact/ContactForm.tsx');
    expect(form).not.toMatch(/<legend|About you|setPhone/);
    expect(form).toMatch(/send\('message'\)/);
    expect(form).toMatch(/send\('meeting'\)/);
    // Both buttons name the action: "Book a fit call", as on every CTA (full-site audit, 2026-10-13).
    expect(form).toMatch(/Book a fit call/);
    expect(form).not.toMatch(/Book a meeting/);
    // Only the free-text box is optional.
    expect(form.match(/\boptional\b>/g)).toHaveLength(1);
  });
});

// Full-site audit (2026-10-13): one name per thing, sentence-case labels.
describe('one name per thing (full-site audit, 2026-10-13)', () => {
  it('calls the fee a "fixed monthly fee" everywhere', () => {
    expect(PRICING_TRUST_ITEMS).toContain('Fixed monthly fee');
    for (const page of ['accounting', 'bookkeeping', 'payroll']) {
      expect(src(`app/(site)/${page}/page.tsx`)).not.toMatch(/Flat monthly pricing/);
    }
    expect(src('app/(site)/pricing/page.tsx')).not.toMatch(/Transparent/);
  });

  it('names the product a subscription from the button to the proposal', () => {
    expect(src('config/calculatorCopy.ts')).toMatch(/PRICING_PAGE_HEADING = 'Build your subscription'/);
    expect(src('lib/email/messages.mjs')).not.toMatch(/building a package/);
    expect(src('app/proposal/[token]/page.tsx')).not.toMatch(/proposed package|Build your package|build your package/);
    expect(src('app/proposal/confirm/[ctoken]/page.tsx')).not.toMatch(/Build your package/);
  });

  it('has no uppercase micro-labels on the problem cards or the signing document', () => {
    expect(src('components/landing/ProblemCards.tsx')).not.toMatch(/uppercase/);
    expect(src('components/proposal/ProposalSections.tsx')).not.toMatch(/uppercase/);
    expect(src('app/proposal/[token]/page.tsx')).not.toMatch(/uppercase/);
    expect(src('lib/proposal/renderProposalDocumentHtml.ts')).not.toMatch(/text-transform:uppercase/);
  });

  it('tells card 4 as a scene', () => {
    expect(src('components/landing/ProblemCards.tsx')).toMatch(/Sunday night is admin night/);
    expect(src('components/landing/ProblemCards.tsx')).not.toMatch(/owner dependence/);
  });
});

describe('after signing (full-site audit A02/A03, 2026-10-13)', () => {
  it('points the signed page at the onboarding checklist in the homepage words', () => {
    const moment = src('components/proposal/SignedMoment.tsx');
    expect(moment).toMatch(/href="\/resources\/onboarding-checklist"/);
    expect(moment).toMatch(/Start gathering what we&rsquo;ll need/);
    expect(moment).toMatch(/Start gathering now and your first month goes\s+faster\./);
  });

  // The signed moment (D11 preview): both signed views end on the same
  // confirmation and the homepage's "Handing over" card.
  it('right after confirming and on the signed link, the signed moment shows the Handing over card', () => {
    expect(src('components/proposal/ConfirmSignButton.tsx')).toContain('<SignedMoment');
    expect(src('app/proposal/[token]/page.tsx')).toContain('<SignedMoment');
    const moment = src('components/proposal/SignedMoment.tsx');
    expect(moment).toContain('<DeckCard card={HANDING_OVER_CARD}');
    expect(src('components/landing/FirstNinetyDays.tsx')).toMatch(/HANDING_OVER_CARD = CARDS\[0\]/);
    expect(src('components/landing/FirstNinetyDays.tsx')).toMatch(/title: "Handing over"/);
  });
});
