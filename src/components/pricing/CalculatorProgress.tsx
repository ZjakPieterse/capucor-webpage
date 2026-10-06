'use client';

interface CalculatorProgressProps {
  /** 0 to 1; see progressFraction in lib/calculatorFlow. */
  value: number;
}

// One bar that fills as the visitor goes (tweaks round 1, 2026-10-06): no
// numbered steps and no stage names.
export function CalculatorProgress({ value }: CalculatorProgressProps) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label="Calculator progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="mx-auto mb-8 h-1.5 w-full max-w-2xl overflow-hidden rounded-full bg-border/70"
    >
      <div
        className="h-full rounded-full bg-primary origin-left will-change-transform"
        style={{
          transform: `scaleX(${percent / 100})`,
          transition: 'transform 600ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />
    </div>
  );
}
