'use client';

import { Check, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { siteConfig } from '@/config/site';
import { FIT_CALL_PROMPT, type QuestionCopy } from '@/config/calculatorCopy';
import type { Bracket } from '@/types';

// One question per screen (calculator-v2). Two shapes share one shell: a
// bracket question answered from a dropdown, and a Yes / No question answered
// with two choice cards that move straight on.

interface ShellProps {
  copy: QuestionCopy;
  /** "Question 2 of 4" within the current stage. */
  position: string;
  canProceed: boolean;
  onNext: () => void;
  /** Omitted on the first screen. */
  onBack?: () => void;
  showFitCall?: boolean;
  children: React.ReactNode;
}

function QuestionShell({
  copy,
  position,
  canProceed,
  onNext,
  onBack,
  showFitCall,
  children,
}: ShellProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
          {position}
        </p>
        <h2 className="text-xl sm:text-2xl font-semibold mb-1.5">{copy.title}</h2>
        <p className="text-sm text-muted-foreground">{copy.hint}</p>
      </div>

      {children}

      <div className="flex items-center justify-between gap-3 pt-2">
        {onBack ? (
          <Button variant="outline" onClick={onBack}>
            ← Back
          </Button>
        ) : (
          <span />
        )}
        <Button
          onClick={onNext}
          disabled={!canProceed}
          className={cn('gap-2', canProceed && 'cta-armed')}
        >
          Continue →
        </Button>
      </div>

      {showFitCall && (
        <p className="text-xs text-muted-foreground text-right">
          {FIT_CALL_PROMPT}{' '}
          <a
            href={siteConfig.links.booking}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary/80 underline underline-offset-2"
          >
            Book a fit call →
          </a>
        </p>
      )}
    </div>
  );
}

interface BracketQuestionProps extends Omit<ShellProps, 'children' | 'canProceed'> {
  serviceSlug: string;
  brackets: Bracket[];
  value: number | undefined;
  onChange: (value: number) => void;
}

export function BracketQuestion({
  serviceSlug,
  brackets,
  value,
  onChange,
  ...shell
}: BracketQuestionProps) {
  const options = brackets
    .filter((b) => b.service_slug === serviceSlug && !b.is_enterprise)
    .sort((a, b) => a.display_order - b.display_order);
  const isSet = typeof value === 'number';

  return (
    <QuestionShell {...shell} canProceed={isSet}>
      <div>
        <Select
          value={isSet ? String(value) : ''}
          onValueChange={(val) => onChange(Number(val))}
          items={Object.fromEntries(options.map((b) => [String(b.ordinal), b.label]))}
        >
          <SelectTrigger
            size="default"
            aria-label={shell.copy.title}
            className={cn(
              'scope-trigger w-full h-11 text-sm',
              isSet ? 'is-set' : 'border-border bg-background/60'
            )}
          >
            <SelectValue placeholder="Select a range…" />
          </SelectTrigger>
          <SelectContent align="start">
            {options.map((bracket) => (
              <SelectItem key={bracket.id} value={String(bracket.ordinal)}>
                {bracket.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </QuestionShell>
  );
}

interface YesNoQuestionProps extends Omit<ShellProps, 'children' | 'canProceed'> {
  value: boolean | null;
  /** Records the answer; the caller moves on. */
  onAnswer: (value: boolean) => void;
}

export function YesNoQuestion({ value, onAnswer, ...shell }: YesNoQuestionProps) {
  const choices = [
    { label: 'Yes', value: true, Icon: Check },
    { label: 'No', value: false, Icon: Minus },
  ] as const;

  return (
    <QuestionShell {...shell} canProceed={value !== null}>
      <div role="radiogroup" aria-label={shell.copy.title} className="grid grid-cols-2 gap-3 sm:gap-4">
        {choices.map(({ label, value: choice, Icon }) => {
          const isSelected = value === choice;
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onAnswer(choice)}
              className={cn(
                'service-card relative rounded-2xl border-2 p-5 text-left outline-none flex items-center gap-3',
                'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2',
                isSelected
                  ? 'is-selected border-primary bg-primary/10 backdrop-blur-md shadow-lg shadow-primary/10'
                  : 'border-border bg-card/40 backdrop-blur-md'
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  isSelected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={2.5} />
              </span>
              <span className="font-semibold">{label}</span>
            </button>
          );
        })}
      </div>
    </QuestionShell>
  );
}
