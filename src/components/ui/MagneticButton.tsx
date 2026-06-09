'use client';

import { ReactNode, useRef } from 'react';
import { motion, useSpring, useMotionValue } from 'motion/react';
import { useCursorGlow } from '@/hooks/useCursorGlow';
import { cn } from '@/lib/utils';

export function MagneticButton({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useCursorGlow<HTMLDivElement>();
  // Centre of the button, captured once per hover. mousemove can fire well
  // over 100×/s and getBoundingClientRect forces a layout flush each call —
  // reading it there causes frame drops. The element also translates while
  // hovered, so the entry rect is the more stable anchor anyway.
  const center = useRef<{ x: number; y: number } | null>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { damping: 15, stiffness: 150, mass: 0.1 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  const handleMouseEnter = () => {
    if (!ref.current) return;
    const { height, width, left, top } = ref.current.getBoundingClientRect();
    center.current = { x: left + width / 2, y: top + height / 2 };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!center.current) return;
    x.set((e.clientX - center.current.x) * 0.3);
    y.set((e.clientY - center.current.y) * 0.3);
  };

  const handleMouseLeave = () => {
    center.current = null;
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x: springX, y: springY }}
      className={cn("relative inline-flex", className)}
    >
      {children}
    </motion.div>
  );
}
