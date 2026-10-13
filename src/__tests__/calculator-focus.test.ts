// Calculator focus and step announcements (full-site audit A14, 2026-10-13).
// After each move the new screen's heading takes focus and a polite live
// region names the step. This suite runs in node (no DOM), so it checks the
// pieces: every screen's heading is focusable and marked, the helper focuses
// it, the calculator wires both in, and the step count follows the path.

import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BracketQuestion, YesNoQuestion } from '@/components/pricing/QuestionStep';
import { AddonsStep } from '@/components/pricing/AddonsStep';
import { ReviewStep } from '@/components/pricing/ReviewStep';
import { Step2Tiers } from '@/components/pricing/Step2Tiers';
import { QUESTION_COPY, stepAnnouncement } from '@/config/calculatorCopy';
import { stepPosition } from '@/lib/calculatorFlow';
import { STEP_HEADING_SELECTOR, focusStepHeading } from '@/lib/stepFocus';
import type { Bracket, CalculatorAnswers, CalculatorStep, Service, Tier } from '@/types';

const noop = () => {};
const answers = (over: Partial<CalculatorAnswers> = {}): CalculatorAnswers => ({
  vatRegistered: null,
  needsPayroll: null,
  ...over,
});

const brackets = [
  { service_slug: 'accounting', ordinal: 1, label: '0 – 1 Mil', basic_price: 725, pro_price: 950, premium_price: 1525, active: true },
  { service_slug: 'bookkeeping', ordinal: 0, label: 'Dormant', basic_price: 0, pro_price: 0, premium_price: 0, active: true },
] as unknown as Bracket[];
const services = [
  { slug: 'accounting', name: 'Accounting' },
  { slug: 'bookkeeping', name: 'Bookkeeping' },
] as Service[];
const tiers = [
  { slug: 'basic', name: 'Basic', display_order: 1 },
  { slug: 'pro', name: 'Pro', display_order: 2 },
] as Tier[];
const selection = {
  brackets,
  selectedServices: new Set(['accounting', 'bookkeeping']),
  selectedBrackets: { accounting: 1, bookkeeping: 0 },
  selectedTier: 'pro',
};

// The one h2 on a screen, as rendered.
const headingOf = (html: string) => html.match(/<h2[^>]*>/g) ?? [];

describe('every calculator screen has a focusable, marked heading', () => {
  const screens: [string, string][] = [
    ['bracket question', renderToStaticMarkup(createElement(BracketQuestion, {
      copy: QUESTION_COPY.revenue, serviceSlug: 'accounting', brackets, value: undefined, onChange: noop, onNext: noop,
    }))],
    ['yes / no question', renderToStaticMarkup(createElement(YesNoQuestion, {
      copy: QUESTION_COPY.vat, value: null, onAnswer: noop, onNext: noop, onBack: noop,
    }))],
    ['package', renderToStaticMarkup(createElement(Step2Tiers, {
      ...selection, services, tiers, pricedAddons: [], answers: answers(),
      onEditAnswer: noop, onTierSelect: noop, onBack: noop, onNext: noop,
    }))],
    ['add-ons', renderToStaticMarkup(createElement(AddonsStep, {
      ...selection, selectedAddons: [], pricedAddons: [], onToggleAddon: noop, onSetQuantity: noop, onBack: noop, onNext: noop,
    }))],
    ['review', renderToStaticMarkup(createElement(ReviewStep, {
      ...selection, services, tiers, selectedAddons: [], answers: answers(), onBack: noop, onAction: noop,
    }))],
  ];

  it.each(screens)('%s', (_name, html) => {
    const h2 = headingOf(html);
    expect(h2).toHaveLength(1);
    expect(h2[0]).toContain('tabindex="-1"');
    expect(h2[0]).toContain('data-step-heading');
  });
});

describe('focusStepHeading', () => {
  it('focuses the marked heading without scrolling', () => {
    const focus = vi.fn();
    const querySelector = vi.fn().mockReturnValue({ focus });
    expect(focusStepHeading({ querySelector } as unknown as ParentNode)).toBe(true);
    expect(querySelector).toHaveBeenCalledWith(STEP_HEADING_SELECTOR);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('does nothing without a screen or a heading', () => {
    expect(focusStepHeading(null)).toBe(false);
    expect(focusStepHeading({ querySelector: () => null } as unknown as ParentNode)).toBe(false);
  });
});

describe('the calculator wires focus and the live region', () => {
  const src = readFileSync(join(__dirname, '..', 'components', 'pricing', 'PricingCalculator.tsx'), 'utf8');

  it('focuses the heading as each new screen mounts, once the visitor has moved', () => {
    expect(src).toMatch(/key=\{step\}\s+ref=\{focusNewScreen\}/);
    expect(src).toMatch(/if \(moved\.current\) focusStepHeading\(el\)/);
  });

  it('every move marks it: answer, Continue, Back, and an answer chip on the package step', () => {
    for (const fn of ['const advance', 'const editAnswer', 'const back']) {
      const body = src.slice(src.indexOf(fn), src.indexOf('};', src.indexOf(fn)));
      expect(body, fn).toContain('markMoved();');
    }
  });

  it('announces the step in a polite status region', () => {
    expect(src).toMatch(/role="status" aria-live="polite" className="sr-only"/);
    expect(src).toContain('stepAnnouncement(position.index, position.total)');
  });
});

describe('stepPosition and the announcement', () => {
  const at = (step: CalculatorStep, a = answers()) => stepPosition(step, { answers: a });

  it('counts the steps along the visitor path', () => {
    expect(at('revenue')).toEqual({ index: 1, total: 7 });
    expect(at('vat')).toEqual({ index: 3, total: 7 });
    expect(at('review')).toEqual({ index: 7, total: 7 });
    expect(stepAnnouncement(3, 7)).toBe('Step 3 of 7');
  });

  it('a payroll Yes adds the headcount screen; the review step stays last', () => {
    const yes = answers({ needsPayroll: true });
    expect(at('employees', yes)).toEqual({ index: 5, total: 8 });
    expect(at('package', yes)).toEqual({ index: 6, total: 8 });
    expect(at('review', yes)).toEqual({ index: 8, total: 8 });
  });
});
