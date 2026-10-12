import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

interface TypedHeadingProps {
  text: string;
  className?: string;
}

// Total typing time stays under ~0.9s however long the heading is.
const STEP_MS = 22;
const MAX_TOTAL_MS = 900;

/**
 * A section `<h2>` that types itself in, letter by letter, as it scrolls in
 * (`.heading-type` in globals.css, armed by `RevealObserver`). Server-rendered:
 * the letters are in the HTML and visible without JavaScript or under reduced
 * motion. Words are kept whole so a heading never breaks mid-word, and the
 * heading reads as one label to screen readers rather than letter by letter.
 */
export function TypedHeading({ text, className }: TypedHeadingProps) {
  const words = text.split(' ');
  const letters = words.reduce((n, w) => n + w.length, 0);
  const step = Math.min(STEP_MS, Math.floor(MAX_TOTAL_MS / Math.max(letters, 1)));
  let i = 0;
  return (
    <h2 className={cn('heading-type', className)} aria-label={text}>
      {words.map((word, w) => (
        <span key={w} aria-hidden="true">
          {w > 0 && ' '}
          <span className="ht-word">
            {Array.from(word).map((ch, c) => (
              <span
                key={c}
                className="ht-ch"
                style={{ '--ht-delay': `${i++ * step}ms` } as CSSProperties}
              >
                {ch}
              </span>
            ))}
          </span>
        </span>
      ))}
    </h2>
  );
}
