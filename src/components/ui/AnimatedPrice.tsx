'use client';

import { useEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import { cn, formatZARNumber } from '@/lib/utils';

interface AnimatedPriceProps {
  amount: number;
  size?: 'lg' | 'base';
  className?: string;
  duration?: number;
}

export function AnimatedPrice({
  amount,
  size = 'base',
  className,
  duration = 0.5,
}: AnimatedPriceProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevRef = useRef(amount);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const from = prevRef.current;
    const to = amount;
    prevRef.current = to;

    if (reduceMotion || from === to) {
      el.textContent = formatZARNumber(to);
      return;
    }

    const hasChanged = from !== to;
    let revealTimeout: ReturnType<typeof setTimeout> | null = null;

    if (hasChanged) {
      el.classList.remove('price-first-reveal');
      // force reflow so the animation re-triggers if it fires repeatedly
      void el.offsetWidth;
      el.classList.add('price-first-reveal');
      revealTimeout = setTimeout(() => {
        el.classList.remove('price-first-reveal');
      }, 900);
    }

    const controls = animate(from, to, {
      duration: (from === 0 && to > 0) ? 0.8 : duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(value) {
        el.textContent = formatZARNumber(Math.round(value));
      },
    });
    return () => {
      controls.stop();
      if (revealTimeout) clearTimeout(revealTimeout);
    };
  }, [amount, duration, reduceMotion]);

  if (size === 'lg') {
    return (
      <span className={cn('inline-flex items-baseline font-sans text-foreground tracking-tight', className)}>
        <span className="text-2xl font-bold text-muted-foreground mr-1 select-none">R</span>
        <span
          ref={ref}
          className="text-4xl font-extrabold font-mono tabular-nums leading-none"
        >
          {formatZARNumber(amount)}
        </span>
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-baseline font-sans text-foreground', className)}>
      <span className="text-xs font-semibold text-muted-foreground mr-0.5 select-none">R</span>
      <span
        ref={ref}
        className="text-base font-semibold font-mono tabular-nums"
      >
        {formatZARNumber(amount)}
      </span>
    </span>
  );
}
