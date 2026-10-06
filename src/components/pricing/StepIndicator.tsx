'use client';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { CALCULATOR_STAGES, type CalculatorStage } from '@/config/calculatorCopy';

interface StepIndicatorProps {
  currentStep: CalculatorStage;
  /** True once the details modal has been submitted and the proposal created. */
  completed?: boolean;
}

// Five stages (Your business, Payroll, Package, Add-ons, Review). Stages 1 and
// 2 hold one question per screen; the indicator shows the stage, not the screen.
const STEPS = CALCULATOR_STAGES;
const LAST = STEPS[STEPS.length - 1]!.number;

export function StepIndicator({ currentStep, completed = false }: StepIndicatorProps) {
  return (
    <nav aria-label="Calculator progress" className="mb-8">
      <ol className="flex items-start gap-0">
        {STEPS.map((step, i) => {
          // On completion every stage before Review lights up as done and
          // Review keeps the active glow as the end state.
          const isDone = completed ? step.number < LAST : step.number < currentStep;
          const isActive = completed ? step.number === LAST : step.number === currentStep;

          return (
            <li
              key={step.number}
              className={cn('flex items-start', i === STEPS.length - 1 ? '' : 'flex-1')}
            >
              {/* Column width is pinned to the circle (w-8) so label widths
                  can't skew the flex layout. Labels get a fixed width and
                  overflow the column symmetrically, so circle 3 sits at the
                  true container centre, aligned with the eyebrow above. */}
              <div className="flex flex-col items-center shrink-0 w-8">
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
                    'mt-2 w-16 sm:w-20 text-[10px] sm:text-xs font-medium text-center leading-tight transition-colors duration-300',
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>

              {i < STEPS.length - 1 && (
                <div className="flex-1 h-[2px] mt-4 mx-1.5 sm:mx-3 bg-border relative overflow-hidden rounded-full">
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
