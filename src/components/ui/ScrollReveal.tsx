import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  /** Stagger, in seconds. */
  delay?: number;
}

// A plain server-rendered wrapper: the fade-up is CSS (`.reveal` in
// globals.css), armed by one shared observer (`RevealObserver`), not a `motion`
// component per block (home-hydration, 2026-10-08). With `motion`, every block
// shipped at `opacity: 0` in the server HTML, so a phone that scrolled before
// hydration saw empty sections, and each block was a client component to
// hydrate. Content is visible without JavaScript and under reduced motion.
export function ScrollReveal({ children, className, delay = 0 }: ScrollRevealProps) {
  return (
    <div
      className={cn('reveal', className)}
      style={delay ? ({ '--reveal-delay': `${delay}s` } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
