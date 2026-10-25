// Package cards are articles with one real button each (design review D2,
// 2026-10-25). Before, each card was a <button> holding the inclusions list,
// and its aria-label replaced the content, so screen readers never heard
// what a package includes. This suite renders the step and checks the shape.

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Step2Tiers } from '@/components/pricing/Step2Tiers';
import type { Bracket, CalculatorAnswers, Service, Tier } from '@/types';

const noop = () => {};
const answers: CalculatorAnswers = { needsAccounting: true, vatRegistered: true, needsPayroll: false };
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
  { slug: 'premium', name: 'Premium', display_order: 3 },
] as Tier[];

const render = (selectedTier: string | null) =>
  renderToStaticMarkup(
    createElement(Step2Tiers, {
      services, brackets, tiers, answers, selectedTier,
      selectedServices: new Set(['accounting', 'bookkeeping']),
      selectedBrackets: { accounting: 1, bookkeeping: 0 },
      pricedAddons: [], onEditAnswer: noop, onTierSelect: noop, onBack: noop, onNext: noop,
    })
  );

// Each card's markup, from its <article> to the matching </article>.
const cards = (html: string) => html.match(/<article[\s\S]*?<\/article>/g) ?? [];

describe('package cards (design review D2)', () => {
  it('renders each package as an article named by its heading', () => {
    const html = render(null);
    const list = cards(html);
    expect(list).toHaveLength(3);
    for (const t of tiers) {
      expect(html).toContain(`aria-labelledby="tier-name-${t.slug}"`);
      expect(html).toMatch(new RegExp(`<h3 id="tier-name-${t.slug}"[^>]*>${t.name}</h3>`));
    }
  });

  it('gives each card one real "Choose" button with aria-pressed, outside any list', () => {
    const html = render(null);
    for (const card of cards(html)) {
      const buttons = card.match(/<button[\s\S]*?<\/button>/g) ?? [];
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toContain('aria-pressed="false"');
      expect(buttons[0]).toMatch(/Choose (Basic|Pro|Premium)/);
      expect(buttons[0]).not.toMatch(/<ul|<li|aria-label=/);
    }
    // The card itself is no longer a button.
    expect(html).not.toMatch(/<button[^>]*pricing-card-item/);
  });

  it('marks the chosen package pressed and keeps its name in the button', () => {
    const pro = cards(render('pro')).find((c) => c.includes('tier-name-pro'))!;
    expect(pro).toContain('aria-pressed="true"');
    expect(pro).toMatch(/Selected<span class="sr-only">: <!-- -->Pro<\/span>|Selected<span class="sr-only">: Pro<\/span>/);
  });

  it('keeps the inclusions as plain list content and the Recommended badge readable', () => {
    const html = render(null);
    for (const card of cards(html)) expect(card).toMatch(/<ul[\s\S]*<li/);
    const pro = cards(html).find((c) => c.includes('tier-name-pro'))!;
    expect(pro).toMatch(/<span class="pointer-events-none absolute[^"]*">Recommended<\/span>/);
  });
});

// Package step value (Zjak, 2026-10-25): Basic names its core lines, Pro and
// Premium open with a neutral "Everything in …, plus:" chip that names the list.
describe('package card lines (package step value)', () => {
  it('shows the chip on Pro and Premium only, neutral, naming the list', () => {
    const [basic, pro, premium] = cards(render(null));
    expect(basic).not.toContain('Everything in');
    expect(pro).toContain('Everything in Basic, plus:');
    expect(premium).toContain('Everything in Pro, plus:');
    for (const [card, slug] of [[pro, 'pro'], [premium, 'premium']] as const) {
      const chip = card!.match(new RegExp(`<p id="tier-lead-${slug}"[^>]*>`))![0];
      expect(chip).not.toMatch(/primary|cyan/);
      expect(card).toContain(`<ul aria-labelledby="tier-lead-${slug}"`);
    }
  });

  it('without payroll: Basic core lines, no summary line, no payroll, no WhatsApp', () => {
    const html = render(null);
    const [basic, pro] = cards(html);
    for (const line of ['Dedicated finance team', 'Annual financial statements', 'SARS &amp; CIPC submission', 'Monthly processing']) {
      expect(basic).toContain(line);
    }
    expect(pro).not.toContain('Monthly processing');
    expect(html).not.toMatch(/Core services included|Payroll processing|WhatsApp/);
  });
});
