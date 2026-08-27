'use client';

import { useState, useRef, useEffect, useId } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InfoTooltipProps {
  content: string;
}

export function InfoTooltip({ content }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
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

      {open && (
        <div
          id={id}
          role="tooltip"
          className={cn(
            'absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-50',
            'w-max max-w-[260px] rounded-md px-3 py-2',
            'bg-foreground text-background text-xs leading-relaxed shadow-lg',
            'pointer-events-none select-none'
          )}
        >
          {content}
          <span
            aria-hidden="true"
            className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 block border-[5px] border-transparent border-t-foreground"
          />
        </div>
      )}
    </span>
  );
}
