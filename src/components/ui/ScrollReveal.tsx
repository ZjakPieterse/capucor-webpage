'use client';

import { motion, useInView, useReducedMotion } from 'motion/react';
import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function ScrollReveal({ children, className, delay = 0 }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  // Reduced-motion visitors get the content in place, with no slide or fade.
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, ease: 'easeOut', delay }}
    >
      {children}
    </motion.div>
  );
}
