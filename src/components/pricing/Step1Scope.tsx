'use client';

import { BarChart2, BookMarked, Check, Minus, Users } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { siteConfig } from '@/config/site';
import { useCursorGlow } from '@/hooks/useCursorGlow';
import { MagneticButton } from '@/components/ui/MagneticButton';
import type { Bracket, BracketValue, Service } from '@/types';

const SERVICE_ICONS: Record<string, React.ElementType> = {
  accounting: BarChart2,
  bookkeeping: BookMarked,
  payroll: Users,
};

// The question IS each card's header — picking a range opts the service in,
// "Not required" opts it out. Fallback: the service's bracket unit label.
const SERVICE_QUESTIONS: Record<string, string> = {
  accounting: 'What is your annual revenue?',
  bookkeeping: 'How many monthly transactions do you have?',
  payroll: 'How many employees do you have?',
};

const NOT_REQUIRED = 'not_required' as const;

interface Step1ScopeProps {
  services: Service[];
  brackets: Bracket[];
  selectedBrackets: Record<string, BracketValue>;
  onBracketChange: (slug: string, value: BracketValue) => void;
  onNext: () => void;
  canProceed: boolean;
}

export function Step1Scope({
  services,
  brackets,
  selectedBrackets,
  onBracketChange,
  onNext,
  canProceed,
}: Step1ScopeProps) {
  const containerRef = useCursorGlow<HTMLDivElement>();
  const reduceMotion = useReducedMotion();

  const totalQuestions = services.length;
  const answered = services.filter((s) => s.slug in selectedBrackets).length;
  const allAnswered = totalQuestions > 0 && answered === totalQuestions;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Tell us a bit about your business.</h2>
        <p className="text-sm text-muted-foreground">
          Answer a quick question for each service so we can match our workflows to your size
          and scale. Don&apos;t need one? Pick &ldquo;Not required&rdquo;.
        </p>
      </div>

      <div ref={containerRef} className="cursor-glow space-y-4">
        {services.map((svc, i) => {
          const Icon = SERVICE_ICONS[svc.slug] ?? BarChart2;
          const question = SERVICE_QUESTIONS[svc.slug] ?? svc.bracket_unit_label;
          const svcBrackets = brackets
            .filter((b) => b.service_slug === svc.slug && !b.is_enterprise)
            .sort((a, b) => a.display_order - b.display_order);
          const currentValue = selectedBrackets[svc.slug];
          const isPriced = typeof currentValue === 'number';
          const isSkipped = currentValue === NOT_REQUIRED;
          const isAnswered = isPriced || isSkipped;
          const selectValue = isPriced ? String(currentValue) : isSkipped ? NOT_REQUIRED : '';

          return (
            <motion.div
              key={svc.slug}
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className={cn('scope-card', isPriced && 'is-set', isSkipped && 'is-skipped')}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className={cn('scope-card__icon', isPriced && 'is-set')}>
                  <Icon className="h-5 w-5" />
                  {isAnswered && (
                    <span
                      className={cn('scope-card__check', isSkipped && 'is-muted')}
                      aria-hidden
                    >
                      {isPriced ? (
                        <Check className="h-3 w-3" strokeWidth={3} />
                      ) : (
                        <Minus className="h-3 w-3" strokeWidth={3} />
                      )}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm sm:text-[15px]">{question}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{svc.name}</p>
                </div>
              </div>

              <div className="scope-card__select">
                <Select
                  value={selectValue}
                  onValueChange={(val) =>
                    onBracketChange(
                      svc.slug,
                      val === NOT_REQUIRED ? NOT_REQUIRED : (Number(val) as BracketValue)
                    )
                  }
                  items={{
                    [NOT_REQUIRED]: 'Not required',
                    ...Object.fromEntries(svcBrackets.map((b) => [String(b.ordinal), b.label])),
                  }}
                >
                  <SelectTrigger
                    size="default"
                    className={cn(
                      'scope-trigger w-full h-10 text-sm',
                      isPriced ? 'is-set' : 'border-border bg-background/60'
                    )}
                  >
                    <SelectValue placeholder="Select an option…" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value={NOT_REQUIRED}>Not required</SelectItem>
                    <SelectSeparator />
                    {svcBrackets.map((bracket) => (
                      <SelectItem key={bracket.id} value={String(bracket.ordinal)}>
                        {bracket.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <span
          className={cn('selection-counter', allAnswered && canProceed && 'is-active')}
          aria-live="polite"
        >
          {allAnswered && canProceed && <Check className="h-3 w-3" strokeWidth={3} />}
          {answered} of {totalQuestions} answered
        </span>
        <MagneticButton>
          <Button
            onClick={onNext}
            disabled={!canProceed}
            className={cn('gap-2', canProceed && 'cta-armed')}
          >
            Continue →
          </Button>
        </MagneticButton>
      </div>

      {allAnswered && !canProceed && (
        <p className="text-xs text-muted-foreground text-right -mt-2" aria-live="polite">
          Choose a range for at least one service to continue.
        </p>
      )}

      <p className="text-[11px] text-muted-foreground/70 text-right -mt-1">
        Not sure what you need?{' '}
        <a
          href={siteConfig.links.booking}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary/80 underline underline-offset-2 hover:text-primary"
        >
          Book a fit call →
        </a>
      </p>
    </div>
  );
}
