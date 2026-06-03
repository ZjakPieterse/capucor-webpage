'use client';

import { BarChart2, BookMarked, Check, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useCursorGlow } from '@/hooks/useCursorGlow';
import { MagneticButton } from '@/components/ui/MagneticButton';
import type { Bracket, BracketValue, Service } from '@/types';

const SERVICE_ICONS: Record<string, React.ElementType> = {
  accounting: BarChart2,
  bookkeeping: BookMarked,
  payroll: Users,
};

interface Step2BracketsProps {
  services: Service[];
  brackets: Bracket[];
  selectedServices: Set<string>;
  selectedBrackets: Record<string, BracketValue>;
  onBracketChange: (slug: string, value: BracketValue) => void;
  onBack: () => void;
  onNext: () => void;
  canProceed: boolean;
}

export function Step2Brackets({
  services,
  brackets,
  selectedServices,
  selectedBrackets,
  onBracketChange,
  onBack,
  onNext,
  canProceed,
}: Step2BracketsProps) {
  const activeServices = services.filter((s) => selectedServices.has(s.slug));
  const containerRef = useCursorGlow<HTMLDivElement>();

  const totalLines = activeServices.length;
  const configuredLines = activeServices.filter(
    (s) => typeof selectedBrackets[s.slug] === 'number'
  ).length;
  const allConfigured = totalLines > 0 && configuredLines === totalLines;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">
          Tell us a bit about your business.
        </h2>
        <p className="text-sm text-muted-foreground">
          Select your details below so we can customize our workflows perfectly to your current size and scale.
        </p>
      </div>

      <div
        ref={containerRef}
        className="cursor-glow rounded-2xl premium-glass border divide-y divide-border overflow-hidden"
      >
        {activeServices.map((svc) => {
          const Icon = SERVICE_ICONS[svc.slug] ?? BarChart2;
          const svcBrackets = brackets
            .filter((b) => b.service_slug === svc.slug && !b.is_enterprise)
            .sort((a, b) => a.display_order - b.display_order);
          const currentValue = selectedBrackets[svc.slug];
          const selectValue = currentValue !== undefined ? String(currentValue) : '';
          const isSet = currentValue !== undefined && typeof currentValue === 'number';

          return (
            <div key={svc.slug} className={cn('step2-row', isSet && 'is-set')}>
              <div className="flex items-center gap-3.5 min-w-0">
                <div className={cn('step2-row__icon', isSet && 'is-set')}>
                  <Icon className="h-5 w-5" />
                  {isSet && (
                    <span className="step2-row__check" aria-hidden>
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{svc.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{svc.bracket_unit_label}</p>
                </div>
              </div>

              <div className="step2-row__select">
                <Select
                  value={selectValue}
                  onValueChange={(val) => onBracketChange(svc.slug, Number(val) as BracketValue)}
                  items={Object.fromEntries(svcBrackets.map((b) => [String(b.ordinal), b.label]))}
                >
                  <SelectTrigger
                    size="default"
                    className={cn(
                      'step2-trigger w-full h-10 text-sm',
                      isSet ? 'is-set' : 'border-border bg-background/60'
                    )}
                  >
                    <SelectValue placeholder={`Select ${svc.bracket_unit_label ?? 'size'} range…`} />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {svcBrackets.map((bracket) => (
                      <SelectItem key={bracket.id} value={String(bracket.ordinal)}>
                        {bracket.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <MagneticButton>
          <Button variant="outline" onClick={onBack}>
            ← Back
          </Button>
        </MagneticButton>

        <div className="hidden sm:block">
          <span
            className={cn('selection-counter', allConfigured && 'is-active')}
            aria-live="polite"
          >
            {allConfigured && <Check className="h-3 w-3" strokeWidth={3} />}
            {configuredLines} of {totalLines} configured
          </span>
        </div>

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
    </div>
  );
}
