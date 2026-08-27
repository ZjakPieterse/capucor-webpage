import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Contrast evidence for the canonical dark theme (BD-06, measured 2026-08-27).
 *
 * This is deliberately NOT a browser test. Contrast is arithmetic over the
 * token hex values, so it needs no DOM, no axe and no `e2e/` directory —
 * capucor-web has none, and standing one up to assert ratios would cost more
 * than it returns for a five-page marketing site. What a browser suite WOULD
 * add and this cannot is focus order, landmark structure and computed styles
 * after a cascade; those remain unautomated and are recorded as such in
 * capucor-docs/plans/brand-design-system-v1/BD-06-accessibility-evidence.md.
 *
 * The numbers here are a regression floor. If a future change lowers a ratio
 * below AA this fails, and per §18 of the design system the fix is to change
 * the change — not to lower the threshold.
 */

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Composite a translucent colour over an opaque backdrop, in sRGB. */
function over(src: Rgb, alpha: number, dst: Rgb): Rgb {
  return [
    src[0] * alpha + dst[0] * (1 - alpha),
    src[1] * alpha + dst[1] * (1 - alpha),
    src[2] * alpha + dst[2] * (1 - alpha),
  ];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio. */
function contrast(fg: Rgb | string, bg: Rgb | string): number {
  const f = typeof fg === 'string' ? hexToRgb(fg) : fg;
  const b = typeof bg === 'string' ? hexToRgb(bg) : bg;
  const l1 = luminance(f);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3.0; // SC 1.4.11 — UI components and graphical objects
const AAA_TEXT = 7.0; // SC 1.4.6 — enhanced contrast

// Canonical dark theme, from capucor-docs/knowledge/brand/design-tokens.json
const BACKGROUND = '#020618';
const SURFACE = '#0e172b';
const MUTED = '#1e283d';
const FOREGROUND = '#f8fafc';
const MUTED_FOREGROUND = '#90a1b9';
const PRIMARY = '#2dd4ff';
const PRIMARY_FOREGROUND = '#02101f';
const SUCCESS = '#34d399';
const WARNING = '#f99c00';
const DANGER = '#ff6568';
const INFO = '#38bdf8';

describe('canonical dark theme contrast', () => {
  it('meets AA for every semantic text pairing', () => {
    const pairings: Array<[string, string, string]> = [
      ['foreground on background', FOREGROUND, BACKGROUND],
      ['foreground on surface', FOREGROUND, SURFACE],
      ['foreground on muted', FOREGROUND, MUTED],
      ['muted-foreground on background', MUTED_FOREGROUND, BACKGROUND],
      ['muted-foreground on surface', MUTED_FOREGROUND, SURFACE],
      ['muted-foreground on muted', MUTED_FOREGROUND, MUTED],
      ['primary-foreground on primary', PRIMARY_FOREGROUND, PRIMARY],
      ['primary on background', PRIMARY, BACKGROUND],
      ['primary on surface', PRIMARY, SURFACE],
      ['success on background', SUCCESS, BACKGROUND],
      ['success on surface', SUCCESS, SURFACE],
      ['warning on background', WARNING, BACKGROUND],
      ['warning on surface', WARNING, SURFACE],
      ['danger on background', DANGER, BACKGROUND],
      ['danger on surface', DANGER, SURFACE],
      ['info on background', INFO, BACKGROUND],
      ['info on surface', INFO, SURFACE],
    ];

    const failures = pairings
      .filter(([, fg, bg]) => contrast(fg, bg) < AA_TEXT)
      .map(([label, fg, bg]) => `${label}: ${contrast(fg, bg).toFixed(2)}:1`);

    expect(failures).toEqual([]);
  });

  it('keeps the focus ring visible against every surface it lands on', () => {
    // globals.css uses `outline: 3px solid var(--ring)` at the base layer and
    // `focus-visible:ring-ring/50` in the ui/ primitives. The 50% case is the
    // weaker of the two, so it is the one worth asserting.
    const ringHalf = (bg: string) => over(hexToRgb(PRIMARY), 0.5, hexToRgb(bg));

    for (const bg of [BACKGROUND, SURFACE, MUTED]) {
      expect(contrast(ringHalf(bg), bg)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    }
  });
});

describe('BD-02b status colour convergence (shipped)', () => {
  // The hero Finance Command Centre tiles composite `bg-background/40` over a
  // `premium-glass` card gradient over `bg-card/80` over the page background.
  // Measuring against the nominal surface would overstate the ratios, so the
  // real composite is reconstructed here. The gradient's dark end is the
  // worst case.
  const heroCard = over(hexToRgb(SURFACE), 0.8, hexToRgb(BACKGROUND));
  const glassDark = over(hexToRgb(SURFACE), 0.64, heroCard);
  const tile = over(hexToRgb(BACKGROUND), 0.4, glassDark);

  // The service mini-dashboard tiles are `bg-background/40` over the card,
  // with no premium-glass layer between. A shallower stack, so a separate
  // composite — reusing `tile` here would understate the backdrop.
  const dashTile = over(hexToRgb(BACKGROUND), 0.4, heroCard);

  // Superseded Tailwind values. Retained ONLY as the regression floor these
  // were converged away from (BD-02b, 2026-08-27); they must not reappear in
  // component source.
  const TAILWIND_AMBER_500 = '#eab308';
  const TAILWIND_RED_500 = '#ef4444';

  it('holds AAA for amber at every site after converging on #f99c00', () => {
    // 9.90 -> 8.85, 7.69 -> 7.05 and 9.99 -> 8.93. A sub-1-point loss that
    // stays AAA everywhere, which is what made the convergence affordable.
    const chip = (c: string) => over(hexToRgb(c), 0.15, tile);

    expect(contrast(WARNING, tile)).toBeGreaterThanOrEqual(AAA_TEXT);
    expect(contrast(WARNING, chip(WARNING))).toBeGreaterThanOrEqual(AAA_TEXT);
    expect(contrast(WARNING, dashTile)).toBeGreaterThanOrEqual(AAA_TEXT);

    // The loss is real; pin its size so a future token edit cannot widen it
    // unnoticed.
    expect(contrast(TAILWIND_AMBER_500, tile) - contrast(WARNING, tile))
      .toBeLessThan(1.5);
  });

  it('clears the red VAT chip defect by converging on #ff6568', () => {
    // The chip paints its status colour at 15% alpha behind the same colour
    // as text, which lifts the backdrop toward the text and crushes the
    // ratio. #ef4444 sat at 4.43:1 — the one pairing on the site below AA.
    // #ff6568 reaches 5.54:1, so the brand change and the accessibility fix
    // pointed the same way. This is a live path: vatStatus goes red when the
    // VAT deadline is <= 7 days out, roughly eight days in every month.
    const superseded = over(hexToRgb(TAILWIND_RED_500), 0.15, tile);
    const shipped = over(hexToRgb(DANGER), 0.15, tile);

    expect(contrast(TAILWIND_RED_500, superseded)).toBeLessThan(AA_TEXT);
    expect(contrast(DANGER, shipped)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('routes the converged status colours through tokens, not literals', () => {
    // The convergence is only durable if the literals cannot creep back. Both
    // components read the canonical values through CSS variables, so assert
    // the superseded Tailwind hexes are absent from component source.
    const files = [
      'src/components/landing/HeroSection.tsx',
      'src/components/services/ServiceMiniDashboards.tsx',
    ];

    for (const file of files) {
      const src = readFileSync(join(process.cwd(), file), 'utf8');
      expect(src).not.toMatch(/eab308/i);
      expect(src).not.toMatch(/ef4444/i);
      // ...and not as the rgba() triplets those hexes expand to.
      expect(src).not.toMatch(/234\s*,\s*179\s*,\s*8/);
      expect(src).not.toMatch(/239\s*,\s*68\s*,\s*68/);
    }
  });

  it('defines the soft tints the status chips composite against', () => {
    // The chip backdrops moved from inline rgba() to --warning-soft and
    // --destructive-soft. Both must stay at the 15% alpha the ratios above
    // were measured at; success-soft is 12% and copying it would shift them.
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

    expect(css).toMatch(/--warning-soft:\s*rgba\(249,\s*156,\s*0,\s*0\.15\)/);
    expect(css).toMatch(/--destructive-soft:\s*rgba\(255,\s*101,\s*104,\s*0\.15\)/);
  });
});

describe('colour is never the only signal (§5)', () => {
  function source(path: string): string {
    return readFileSync(join(process.cwd(), path), 'utf8');
  }

  it('pairs every status colour in the hero dashboard with text or an icon', () => {
    const hero = source('src/components/landing/HeroSection.tsx');

    // The VAT status chip is the one place a bare coloured pill could appear.
    // It carries an AlertCircle icon and a "{n} days" label; assert the icon
    // stays, because the label alone would still leave the severity encoded
    // only in the colour.
    expect(hero).toMatch(/AlertCircle/);

    // The payroll and close tiles state their status in words.
    expect(hero).toMatch(/EMP201 submitted/);
    expect(hero).toMatch(/reviewed/);
  });

  it('pairs the margin trend in the service dashboards with a direction icon', () => {
    const dashboards = source('src/components/services/ServiceMiniDashboards.tsx');

    // A falling margin rendered in amber with no arrow would encode "down"
    // in colour alone.
    expect(dashboards).toMatch(/ArrowDownRight/);
    expect(dashboards).toMatch(/TrendingUp/);
  });
});
