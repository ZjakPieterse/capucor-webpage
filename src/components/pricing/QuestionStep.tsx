'use client';

import { useRef } from 'react';
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
import { formatBandLabel } from '@/lib/pricing';
import { siteConfig } from '@/config/site';
import { FIT_CALL_PROMPT, type QuestionCopy } from '@/config/calculatorCopy';
import type { Bracket } from '@/types';

// One question per screen (calculator-v2). Two shapes share one shell: a
// bracket question answered from a dropdown, and a Yes / No question answered
// with two choice cards that move straight on.

interface ShellProps {
  copy: QuestionCopy;
  canProceed: boolean;
  onNext: () => void;
  /** Omitted on the first screen. */
  onBack?: () => void;
  showFitCall?: boolean;
  /** Overrides the fit-call prompt, e.g. on the transactions screen. */
  fitCallPrompt?: string;
  children: React.ReactNode;
}

function QuestionShell({
  copy,
  canProceed,
  onNext,
  onBack,
  showFitCall,
  fitCallPrompt = FIT_CALL_PROMPT,
  children,
}: ShellProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* The question alone: no eyebrow, no hint (tweaks round 1). */}
      <h2 className="text-xl sm:text-2xl font-semibold">{copy.title}</h2>

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
          {fitCallPrompt}{' '}
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

// Band labels in plain form (F17): "R10m to R15m", "Up to 200 transactions".
// The rows in brackets.label are unchanged.
function optionLabel(b: Pick<Bracket, 'service_slug' | 'label'>): string {
  const label = formatBandLabel(b.service_slug, b.label) ?? b.label;
  return label.charAt(0).toUpperCase() + label.slice(1);
}
interface BracketQuestionProps extends Omit<ShellProps, 'children' | 'canProceed'> {
  serviceSlug: string;
  brackets: Bracket[];
  value: number | undefined;
  onChange: (value: number) => void;
  /** Bracket labels not offered on this screen (e.g. "Dormant" for employees). */
  excludeLabels?: string[];
}

export function BracketQuestion({
  serviceSlug,
  brackets,
  value,
  onChange,
  excludeLabels = [],
  ...shell
}: BracketQuestionProps) {
  const options = brackets
    .filter((b) => b.service_slug === serviceSlug && !b.is_enterprise && !excludeLabels.includes(b.label))
    .sort((a, b) => a.display_order - b.display_order);
  const isSet = typeof value === 'number';

  return (
    <QuestionShell {...shell} canProceed={isSet}>
      <div>
        <Select
          value={isSet ? String(value) : ''}
          onValueChange={(val) => onChange(Number(val))}
          items={Object.fromEntries(options.map((b) => [String(b.ordinal), optionLabel(b)]))}
        >
          <SelectTrigger
            size="default"
            aria-label={shell.copy.title}
            // Larger and calmer than the default trigger (tweaks round 1): a
            // 56 px tap target, base-size text and a bigger chevron.
            className={cn(
              'scope-trigger w-full data-[size=default]:h-14 rounded-xl border-2 pl-4 pr-3.5 text-base shadow-sm [&_svg:not([class*=size-])]:size-5',
              isSet ? 'is-set font-medium' : 'border-border bg-background/60'
            )}
          >
            <SelectValue placeholder="Choose a range" />
          </SelectTrigger>
          <SelectContent align="start" className="max-h-80 rounded-xl p-1.5">
            {options.map((bracket) => (
              <SelectItem
                key={bracket.id}
                value={String(bracket.ordinal)}
                className="rounded-lg py-2.5 pl-3 pr-9 text-base"
              >
                {optionLabel(bracket)}
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
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // Radiogroup pattern: one tab stop (the checked radio, else the first), and
  // the arrow keys move focus between Yes and No. Focus only; Space or Enter
  // answers, so arrowing past an answer does not move the wizard on.
  const tabStop = value === false ? 1 : 0;
  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    buttons.current[index === 0 ? 1 : 0]?.focus();
  }

  return (
    <QuestionShell {...shell} canProceed={value !== null}>
      <div role="radiogroup" aria-label={shell.copy.title} className="grid grid-cols-2 gap-3 sm:gap-4">
        {choices.map(({ label, value: choice, Icon }, index) => {
          const isSelected = value === choice;
          return (
            <button
              key={label}
              ref={(el) => {
                buttons.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={index === tabStop ? 0 : -1}
              onKeyDown={(e) => onKeyDown(e, index)}
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
