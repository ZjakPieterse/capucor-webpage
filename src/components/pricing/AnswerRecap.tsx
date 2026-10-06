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

// The visitor's answers as chips above the packages (package simplification,
// 2026-10-06), so the price reads as theirs and any answer is one tap to change.
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
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground mr-0.5">{ANSWER_RECAP_HEADING}</span>
      {chips.map((chip) => (
        <button
          key={chip.step}
          type="button"
          onClick={() => onEdit(chip.step)}
          aria-label={`Change ${chip.question}: ${chip.text}`}
          className="answer-chip inline-flex items-center gap-1.5 rounded-full border border-border bg-card/40 px-3 py-1.5 text-xs font-medium text-foreground/90 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {chip.text}
          <Pencil aria-hidden className="answer-chip-edit h-3 w-3 text-primary opacity-60 transition-opacity" />
        </button>
      ))}
    </div>
  );
}
