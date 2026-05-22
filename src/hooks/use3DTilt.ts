'use client';

import { useCallback, useRef } from 'react';
import { useMotionValue, useSpring } from 'motion/react';

interface Tilt3DOptions {
  maxTiltDeg?: number;
  liftPx?: number;
  hoverScale?: number;
}

const SPRING_CONFIG = { damping: 18, stiffness: 180, mass: 0.4 };

export function use3DTilt<T extends HTMLElement>({
  maxTiltDeg = 6,
  liftPx = 6,
  hoverScale = 1.012,
}: Tilt3DOptions = {}) {
  const ref = useRef<T | null>(null);

  const rotateX = useSpring(useMotionValue(0), SPRING_CONFIG);
  const rotateY = useSpring(useMotionValue(0), SPRING_CONFIG);
  const lift = useSpring(useMotionValue(0), SPRING_CONFIG);
  const scale = useSpring(useMotionValue(1), SPRING_CONFIG);

  const motionAllowed = useCallback(() => {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return true;
  }, []);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<T>) => {
      const el = ref.current;
      if (!el) return;
      if (!motionAllowed()) return;

      const rect = el.getBoundingClientRect();
      const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const normY = ((e.clientY - rect.top) / rect.height) * 2 - 1;

      rotateY.set(normX * maxTiltDeg);
      rotateX.set(-normY * maxTiltDeg);
      lift.set(-liftPx);
      scale.set(hoverScale);
    },
    [motionAllowed, maxTiltDeg, liftPx, hoverScale, rotateX, rotateY, lift, scale]
  );

  const onMouseLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
    lift.set(0);
    scale.set(1);
  }, [rotateX, rotateY, lift, scale]);

  return { ref, rotateX, rotateY, lift, scale, onMouseMove, onMouseLeave };
}
