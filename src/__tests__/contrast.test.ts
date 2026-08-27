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

describe('BD-02 status colour convergence', () => {
  // The hero Finance Command Centre tiles composite `bg-background/40` over a
  // `premium-glass` card gradient over `bg-card/80` over the page background.
  // Measuring against the nominal surface would overstate the ratios, so the
  // real composite is reconstructed here. The gradient's dark end is the
  // worst case.
  const heroCard = over(hexToRgb(SURFACE), 0.8, hexToRgb(BACKGROUND));
  const glassDark = over(hexToRgb(SURFACE), 0.64, heroCard);
  const tile = over(hexToRgb(BACKGROUND), 0.4, glassDark);

  it('does not regress amber when #eab308 converges on the canonical #f99c00', () => {
    const current = contrast('#eab308', tile);
    const proposed = contrast(WARNING, tile);

    expect(current).toBeGreaterThanOrEqual(AA_TEXT);
    expect(proposed).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('IMPROVES the red chip, which fails AA today', () => {
    // The VAT chip paints its status colour at 15% alpha behind the same
    // colour as text. That is the one pairing on the site below AA, and the
    // canonical #ff6568 is what fixes it — the brand change and the
    // accessibility fix point the same way here.
    const currentChip = over(hexToRgb('#ef4444'), 0.15, tile);
    const proposedChip = over(hexToRgb(DANGER), 0.15, tile);

    const current = contrast('#ef4444', currentChip);
    const proposed = contrast(DANGER, proposedChip);

    expect(current).toBeLessThan(AA_TEXT); // 4.43:1 — the defect BD-02b clears
    expect(proposed).toBeGreaterThanOrEqual(AA_TEXT); // 5.54:1
    expect(proposed).toBeGreaterThan(current);
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
