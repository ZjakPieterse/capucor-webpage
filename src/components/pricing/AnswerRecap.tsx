'use client';

import { Pencil } from 'lucide-react';
import { formatBandLabel } from '@/lib/pricing';
import { ANSWER_RECAP_HEADING } from '@/config/calculatorCopy';
import type { Bracket, BracketValue, CalculatorAnswers, CalculatorStep } from '@/types';

interface AnswerRecapProps {
  brackets: Bracket[];
  selectedBrackets: Record<string, BracketValue>;
  answers: CalculatorAnswers;
  /** Opens the question behind a chip; the calculator returns to the packages after it. */
  onEdit: (step: CalculatorStep) => void;
}

function bandLabel(brackets: Bracket[], slug: string, value: BracketValue | undefined): string | null {
  if (typeof value !== 'number') return null;
  const label = brackets.find((b) => b.service_slug === slug && b.ordinal === value)?.label ?? null;
  const plain = formatBandLabel(slug, label);
  return plain ? plain.charAt(0).toUpperCase() + plain.slice(1) : null;
}

// The visitor's answers above the packages (package simplification,
// 2026-10-06), so the price reads as theirs and any answer is one tap to change.
// A quiet brief between hairlines, not bordered pills (package-page feedback,
// 2026-10-13): the values name themselves, so there are no per-item labels.
export function AnswerRecap({ brackets, selectedBrackets, answers, onEdit }: AnswerRecapProps) {
  const revenue = bandLabel(brackets, 'accounting', selectedBrackets.accounting);
  const transactions = bandLabel(brackets, 'bookkeeping', selectedBrackets.bookkeeping);
  const employees = bandLabel(brackets, 'payroll', selectedBrackets.payroll);

  const chips: { step: CalculatorStep; text: string; question: string }[] = [];
  if (revenue) chips.push({ step: 'revenue', text: `${revenue} revenue`, question: 'annual revenue' });
  if (transactions) chips.push({ step: 'transactions', text: transactions, question: 'monthly transactions' });
  if (answers.vatRegistered !== null) {
    chips.push({
      step: 'vat',
      text: answers.vatRegistered ? 'VAT-registered' : 'Not VAT-registered',
      question: 'VAT registration',
    });
  }
  if (answers.needsPayroll === false) {
    chips.push({ step: 'payroll', text: 'No payroll', question: 'payroll' });
  } else if (answers.needsPayroll && employees) {
    chips.push({ step: 'employees', text: `Payroll for ${employees}`, question: 'employees' });
  }

  if (chips.length === 0) return null;

  return (
    <section aria-labelledby="answer-recap-heading" className="border-y border-border/60 py-2.5">
      {/* Muted, sentence case: cyan is for action and selection only (A2). */}
      <h3 id="answer-recap-heading" className="mb-1 text-left text-sm font-medium text-muted-foreground">
        {ANSWER_RECAP_HEADING}
      </h3>
      {/* Separators are CSS dots (.answer-recap-list), never a literal "|"
          that dangles where the row wraps (design review D5). */}
      <ul className="answer-recap-list">
        {chips.map((chip) => (
          <li key={chip.step} className="inline-flex items-center">
            <button
              type="button"
              onClick={() => onEdit(chip.step)}
              aria-label={`Change ${chip.question}: ${chip.text}`}
              className="answer-chip -mx-1 inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-sm font-medium text-foreground/90 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {chip.text}
              <Pencil aria-hidden className="answer-chip-edit h-3 w-3 text-muted-foreground transition-colors" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
