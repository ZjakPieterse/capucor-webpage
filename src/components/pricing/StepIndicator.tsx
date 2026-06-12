'use client';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import type { CalculatorStep } from '@/types';

interface StepIndicatorProps {
  currentStep: CalculatorStep;
  /** True once the Activate modal has been submitted and the proposal sent. */
  completed?: boolean;
}

// Two real input steps + a 3rd "Done" completion marker (not an input step).
// The banner above reads "2 steps to your monthly price"; the last segment only
// signals that the process is complete.
const STEPS = [
  { number: 1, label: 'Your business' },
  { number: 2, label: 'Choose package' },
  { number: 3, label: 'Done' },
] as const;

export function StepIndicator({ currentStep, completed = false }: StepIndicatorProps) {
  return (
    <nav aria-label="Calculator progress" className="mb-8">
      <ol className="flex items-start gap-0">
        {STEPS.map((step, i) => {
          // On completion every segment lights up and the last ("Done") gets
          // the active glow as the celebratory end state.
          const isDone = completed ? true : step.number < currentStep;
          const isActive = completed ? step.number === 3 : step.number === currentStep;

          return (
            <li
              key={step.number}
              className={cn('flex items-start', i === STEPS.length - 1 ? '' : 'flex-1')}
            >
              <div className="flex flex-col items-center shrink-0">
                <motion.div
                  initial={false}
                  animate={{
                    borderColor: isDone || isActive ? 'var(--brand-primary)' : 'var(--border)',
                    backgroundColor: isDone ? 'var(--brand-primary)' : isActive ? 'color-mix(in oklch, var(--brand-primary) 10%, transparent)' : 'transparent',
                    color: isDone ? 'var(--brand-primary-foreground)' : isActive ? 'var(--brand-primary)' : 'var(--muted-foreground)',
                    scale: isActive ? 1.15 : 1,
                  }}
                  className={cn(
                    'relative h-8 w-8 rounded-full border-2 flex items-center justify-center text-sm font-semibold transition-all duration-300'
                  )}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isActive && (
                    <motion.span
                      layoutId="glow"
                      className="absolute inset-0 rounded-full ring-4 ring-primary/20"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                    />
                  )}
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-full ring-2 ring-primary/30 animate-pulse"
                    />
                  )}
                  <span className="relative z-10">{isDone ? '✓' : step.number}</span>
                </motion.div>
                <span
                  className={cn(
                    'mt-2 text-[10px] sm:text-xs font-medium text-center max-w-[80px] leading-tight transition-colors duration-300',
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>

              {i < STEPS.length - 1 && (
                <div className="flex-1 h-[2px] mt-4 mx-2 sm:mx-3 bg-border relative overflow-hidden rounded-full">
                  <div
                    className="absolute inset-0 bg-primary origin-left will-change-transform"
                    style={{
                      transform: isDone ? 'scaleX(1)' : 'scaleX(0)',
                      transition: 'transform 600ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  />
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 bg-primary/30 origin-left"
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
