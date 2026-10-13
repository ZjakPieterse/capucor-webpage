import { describe, expect, it } from 'vitest';
import { readSource } from './helpers/sourceText';

// The hero story on a phone (funnel review F07; full audit 2026-10-13, wow
// moment 1). Below 640 px the panel tells the same three beats with its own
// three-piece pile, and every line reads at 13 px or more; desktop must not
// change. These read source as text, in the style of site-copy.test.ts.
const story = readSource('src', 'components/landing/HeroStory.tsx');
const css = readSource('src', 'app/globals.css');

/** The source of one top-level function, up to the next top-level declaration. */
function fn(name: string): string {
  const start = story.indexOf(`function ${name}(`);
  expect(start, `function ${name} not found`).toBeGreaterThan(-1);
  const rest = story.slice(start + 1);
  const end = rest.search(/\n(?:export )?(?:function |const |\/\/ ──)/);
  return story.slice(start, end === -1 ? undefined : start + 1 + end);
}

/** Font sizes that apply below `sm` (unprefixed `text-[Npx]`), in px. */
function phoneSizes(src: string): number[] {
  return [...src.matchAll(/(?<![\w:-])text-\[(\d+(?:\.\d+)?)px\]/g)].map((m) => Number(m[1]));
}

/** Desktop font sizes (`sm:` prefixed), in source order. */
function desktopSizes(src: string): string[] {
  return [...src.matchAll(/sm:text-(\[[\d.]+px\]|xs)/g)].map((m) => m[1]);
}

const PHONE_PIECES = ['PhoneReceipt', 'PhoneNotice', 'PhoneInvoice'];
// Everything a phone shows in the order and decision beats, plus the frame.
const SHARED = ['Ledger', 'EmailHeader', 'EmailSubject', 'ReportEmail', 'HeroStory'];

describe('the phone variant exists (F07)', () => {
  it('renders its own three-piece pile below sm and the full pile from sm up', () => {
    expect(story).toMatch(/<div className="hidden sm:block">\s*\{PILE\.map/);
    expect(story).toMatch(/className="hero-phone-pile sm:hidden"[\s\S]{0,80}\{PHONE_PILE\.map/);
    expect(story).toMatch(/const PHONE_PILE: Place\[\] = \[(\s*\[[^\]]+\],){3}\s*\];/);
  });

  it('reuses the receipt, the SARS reminder and the overdue invoice, not new copy', () => {
    expect(story).toMatch(/<PhoneReceipt key="receipt" r=\{s\.receipt\} \/>/);
    expect(story).toMatch(/<PhoneNotice key="reminder" n=\{s\.reminder\} \/>/);
    expect(story).toMatch(/<PhoneInvoice key="invoice" inv=\{s\.invoice\} \/>/);
  });

  it('switches by CSS, never a matchMedia switch after hydration', () => {
    expect(story).not.toMatch(/matchMedia|useSyncExternalStore/);
  });

  it('keeps one timeline: phones get the desktop pacing', () => {
    expect(story).not.toMatch(/TIMING\.(narrow|wide)/);
    expect(story).toMatch(/useStoryTimeline\(timing\)/);
  });
});

describe('every line on a phone reads at 13 px or more', () => {
  it.each(PHONE_PIECES)('%s sets no type below 13 px', (name) => {
    const src = fn(name);
    expect(src).not.toMatch(/(?<![\w:-])text-(xs|\[\d+(\.\d+)?rem\])/);
    const sizes = phoneSizes(src);
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) expect(size, `${name}: text-[${size}px]`).toBeGreaterThanOrEqual(13);
  });

  it.each(SHARED)('%s sets no phone type below 13 px', (name) => {
    const src = fn(name);
    expect(src).not.toMatch(/(?<![\w:-])text-xs\b/);
    for (const size of phoneSizes(src)) expect(size, `${name}: text-[${size}px]`).toBeGreaterThanOrEqual(13);
  });

  it('starts the hero higher on phones and keeps the desktop padding (Zjak, 2026-10-13)', () => {
    expect(readSource('src', 'components/landing/HeroSection.tsx')).toMatch(
      /overflow-hidden pt-12 pb-28 sm:py-28 sm:pb-36 lg:py-32 lg:pb-40/,
    );
  });

  it('gives a 13 px statement row its own height on phones', () => {
    expect(css).toMatch(/\.hero-story \{[^}]*--hero-row: 30px;/);
    expect(story).not.toMatch(/ROW_PX/);
  });

  it('drops the old zoomed narrow pile', () => {
    expect(css).not.toMatch(/hero-pile-wide|zoom: 1\.3|--ln|--wn/);
  });
});

describe('the desktop path is unchanged', () => {
  it('keeps the desktop pacing', () => {
    expect(story).toMatch(
      /const TIMING: Timing = \{\s*chaos: 4800,\s*txCounts: \[23, 29, 18\],\s*perTx: 140,\s*orderTail: 1700,\s*arriving: 1300,\s*decision: 7500,/,
    );
  });

  it('keeps every desktop pile slot', () => {
    const slots = [...story.matchAll(/\{ piece: (\d+), wide: \[([^\]]+)\](, back: true)? \}/g)].map(
      (m) => `${m[1]}:${m[2]}${m[3] ? ':back' : ''}`,
    );
    expect(slots).toEqual([
      '0:2, 1, "36%", -3:back',
      '1:54, 0, "44%", 0',
      '2:22, 22, "58%", 0.6',
      '3:63, 34, "35%", 3:back',
      '4:1, 42, "44%", 0',
      '5:33, 56, "35%", -1.5:back',
      '6:40, 10, "24%", 4:back',
      '7:3, 66, "27%", -5',
      '8:52, 63, "46%", 0',
      '9:72, 54, "25%", 6:back',
      '10:24, 80, "46%", 0',
    ]);
  });

  it('keeps the desktop pile pieces as they were', () => {
    expect(phoneSizes(fn('ReceiptSlip'))).toEqual([8.5, 9, 10]);
    expect(phoneSizes(fn('BankStatement'))).toEqual([9, 9.5, 8]);
    expect(phoneSizes(fn('PhoneNotification'))).toEqual([9, 11, 11]);
    expect(phoneSizes(fn('InvoiceDoc'))).toEqual([8.5, 9.5, 9.5, 8, 10]);
  });

  it('keeps every desktop size in the order and decision beats and the frame', () => {
    expect(desktopSizes(fn('Ledger'))).toEqual(['xs', '[10px]', '[10.5px]', '[11px]']);
    expect(desktopSizes(fn('EmailHeader'))).toEqual(['[12px]', '[12px]', '[10px]', '[10.5px]']);
    expect(desktopSizes(fn('EmailSubject'))).toEqual(['[14px]']);
    expect(desktopSizes(fn('ReportEmail'))).toEqual(['[12.5px]', '[7px]', '[11px]', '[10px]', '[11.5px]']);
    expect(desktopSizes(fn('HeroStory'))).toEqual(['[11px]', '[10px]']);
    expect(story).toMatch(/h-\[440px\] sm:h-\[390px\]/);
    expect(css).toMatch(/@media \(min-width: 640px\) \{\s*\.hero-story \{\s*--hero-row: 26px;/);
  });
});
