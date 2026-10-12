'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface ScrollLitTextProps {
  text: string;
  className?: string;
}

const DIM = 0.22;

/**
 * A statement whose words light up one by one as it scrolls through the
 * screen. Use sparingly: one or two key statements per page, never body copy.
 * The server HTML is the plain, fully lit text, so it reads without
 * JavaScript and under reduced motion. Opacity only, written straight to each
 * word (no React state per frame), and only while the block is near the screen.
 */
export function ScrollLitText({ text, className }: ScrollLitTextProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = text.split(' ');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const spans = Array.from(el.querySelectorAll<HTMLElement>('[data-word]'));

    let rafId = 0;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the top of the block is at 85% of the screen, 1 when its
      // bottom reaches 45%: the reader finishes the sentence mid-screen.
      const start = vh * 0.85;
      const end = vh * 0.45;
      const p = Math.min(1, Math.max(0, (start - rect.top) / (start - end + rect.height)));
      const lit = p * spans.length;
      spans.forEach((s, i) => {
        s.style.opacity = String(Math.min(1, Math.max(DIM, DIM + (lit - i) * (1 - DIM))));
      });
    };
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        window.addEventListener('scroll', onScroll, { passive: true });
        update();
      } else {
        window.removeEventListener('scroll', onScroll);
        update();
      }
    });
    io.observe(el);
    update();
    return () => {
      io.disconnect();
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <p ref={ref} className={cn('scroll-lit', className)}>
      {words.map((w, i) => (
        <span key={i} data-word="">
          {w}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </p>
  );
}
