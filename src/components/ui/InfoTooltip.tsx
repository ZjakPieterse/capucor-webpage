'use client';

import { useState, useRef, useEffect, useLayoutEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InfoTooltipProps {
  content: string;
}

// Keeps the bubble this far from the viewport edges.
const EDGE = 8;

interface Placement {
  top: number;
  left: number;
  /** Arrow offset from the bubble's left edge, so it still points at the icon. */
  arrowLeft: number;
  /** True when there was no room above, so the bubble sits under the icon. */
  below: boolean;
}

// The bubble renders in a portal on document.body with fixed positioning, so
// a parent with overflow hidden (the comparison table's rounded box and
// scroll wrapper) cannot clip it, and it sits above every other layer.
export function InfoTooltip({ content }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const id = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const clickOpenRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent | TouchEvent) {
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      clickOpenRef.current = false;
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
    };
  }, [open]);

  useLayoutEffect(() => {
    // Placed before paint, so a reopened bubble never shows its old spot.
    if (!open) return;
    function place() {
      const btn = btnRef.current?.getBoundingClientRect();
      const tip = tipRef.current?.getBoundingClientRect();
      if (!btn || !tip) return;
      const centre = btn.left + btn.width / 2;
      const maxLeft = window.innerWidth - tip.width - EDGE;
      const left = Math.max(EDGE, Math.min(centre - tip.width / 2, maxLeft));
      // Above the icon; below it when there is no room above.
      const above = btn.top - tip.height - 10;
      const below = above < EDGE;
      const top = below ? btn.bottom + 10 : above;
      setPlacement({ top, left, arrowLeft: centre - left, below });
    }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, content]);

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={btnRef}
        type="button"
        aria-describedby={open ? id : undefined}
        aria-label="More information"
        className={cn(
          'ml-1.5 inline-flex items-center rounded-sm transition-colors',
          'text-muted-foreground/40 hover:text-muted-foreground/70',
          'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
          open && 'text-muted-foreground/70'
        )}
        onMouseEnter={() => { if (!clickOpenRef.current) setOpen(true); }}
        onMouseLeave={() => { if (!clickOpenRef.current) setOpen(false); }}
        onFocus={() => { if (!clickOpenRef.current) setOpen(true); }}
        onBlur={() => { if (!clickOpenRef.current) setOpen(false); }}
        onClick={(e) => {
          e.stopPropagation();
          const next = !open;
          clickOpenRef.current = next;
          setOpen(next);
        }}
      >
        <Info className="h-3 w-3" />
      </button>

      {open && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            style={{
              top: placement?.top ?? 0,
              left: placement?.left ?? 0,
              // Measured first, shown once placed, so it never flashes at 0,0.
              visibility: placement ? 'visible' : 'hidden',
            }}
            className={cn(
              'fixed z-[1000]',
              'w-max max-w-[min(260px,calc(100vw-16px))] rounded-md px-3 py-2',
              'bg-foreground text-background text-xs leading-relaxed shadow-lg',
              'pointer-events-none select-none'
            )}
          >
            {content}
            <span
              aria-hidden="true"
              style={{ left: placement?.arrowLeft ?? 0 }}
              className={cn(
                'absolute -translate-x-1/2 w-0 h-0 block border-[5px] border-transparent',
                placement?.below ? 'bottom-full border-b-foreground' : 'top-full border-t-foreground'
              )}
            />
          </div>,
          document.body
        )}
    </span>
  );
}
