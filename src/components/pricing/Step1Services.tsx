'use client';

import { useEffect, useState } from 'react';
import { BarChart2, BookMarked, Users, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { siteConfig } from '@/config/site';
import { useCursorGlow } from '@/hooks/useCursorGlow';
import { MagneticButton } from '@/components/ui/MagneticButton';
import type { Service } from '@/types';

const SERVICE_ICONS: Record<string, React.ElementType> = {
  accounting: BarChart2,
  bookkeeping: BookMarked,
  payroll: Users,
};

const SERVICE_DELIVERABLES: Record<string, string[]> = {
  accounting: ['Annual financial statements', 'VAT & income tax returns', 'CIPC compliance'],
  bookkeeping: ['Monthly reconciliation', 'Xero software included', 'Supplier processing'],
  payroll: ['Payslips & EMP201 submissions', 'Leave & deduction management', 'UIF compliance'],
};

interface Step1ServicesProps {
  services: Service[];
  selected: Set<string>;
  onToggle: (slug: string) => void;
  onNext: () => void;
}

function counterLabel(count: number) {
  if (count === 0) return '0 selected';
  if (count === 1) return '1 service added';
  return `${count} services added`;
}

export function Step1Services({ services, selected, onToggle, onNext }: Step1ServicesProps) {
  const canContinue = selected.size > 0;
  const containerRef = useCursorGlow<HTMLDivElement>();
  const [timerExpired, setTimerExpired] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimerExpired(true), 5500);
    return () => clearTimeout(t);
  }, []);

  const showBreath = !timerExpired && selected.size === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">What can we take off your plate?</h2>
        <p className="text-sm text-muted-foreground">
          Click and select the financial services your business needs. We&rsquo;ll bundle them into a single, predictable monthly subscription.
        </p>
      </div>

      <div ref={containerRef} className="cursor-glow grid sm:grid-cols-3 gap-4">
        {services.map((svc) => {
          const Icon = SERVICE_ICONS[svc.slug] ?? BarChart2;
          const isSelected = selected.has(svc.slug);
          const deliverables = SERVICE_DELIVERABLES[svc.slug] ?? [];

          return (
            <div
              key={svc.slug}
              role="button"
              tabIndex={0}
              onClick={() => onToggle(svc.slug)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onToggle(svc.slug);
                }
              }}
              aria-pressed={isSelected}
              aria-label={`${isSelected ? 'Remove' : 'Add'} ${svc.name}`}
              className={cn(
                'service-card relative rounded-2xl border-2 p-6 pr-12 text-left outline-none cursor-pointer',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isSelected
                  ? 'is-selected border-primary bg-primary/10 backdrop-blur-md shadow-lg shadow-primary/10'
                  : 'border-border bg-card/40 backdrop-blur-md',
                showBreath && 'service-card-breath'
              )}
            >
              <span
                aria-hidden
                className={cn('service-card-toggle', isSelected && 'is-selected')}
              >
                {isSelected ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                ) : (
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                )}
              </span>

              <div
                className={cn(
                  'mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-200',
                  isSelected ? 'bg-primary/15' : 'bg-muted'
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 transition-colors duration-200',
                    isSelected ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
              </div>
              <div className="font-semibold mb-1">{svc.name}</div>
              {svc.description && (
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">{svc.description}</p>
              )}
              {deliverables.length > 0 && (
                <ul className="space-y-1">
                  {deliverables.map((item) => (
                    <li key={item} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span
                        className={cn(
                          'h-1 w-1 rounded-full shrink-0 transition-colors duration-200',
                          isSelected ? 'bg-primary' : 'bg-muted-foreground/50'
                        )}
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <span
          className={cn('selection-counter', canContinue && 'is-active')}
          aria-live="polite"
        >
          {canContinue && <Check className="h-3 w-3" strokeWidth={3} />}
          {counterLabel(selected.size)}
        </span>
        <MagneticButton>
          <Button
            onClick={onNext}
            disabled={!canContinue}
            className={cn('gap-2', canContinue && 'cta-armed')}
          >
            Continue →
          </Button>
        </MagneticButton>
      </div>

      <p className="text-[11px] text-muted-foreground/70 text-right -mt-1">
        Not sure which to pick?{' '}
        <a
          href={siteConfig.links.booking}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary/80 underline underline-offset-2 hover:text-primary"
        >
          Book a 15-minute fit call →
        </a>
      </p>
    </div>
  );
}
