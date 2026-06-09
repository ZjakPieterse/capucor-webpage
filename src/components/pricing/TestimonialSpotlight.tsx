'use client';

import { Quote } from 'lucide-react';
import type { Testimonial } from '@/types';

interface TestimonialSpotlightProps {
  testimonial: Testimonial;
}

export function TestimonialSpotlight({ testimonial: t }: TestimonialSpotlightProps) {
  const subtitle = [t.role, t.business].filter(Boolean).join(' · ');

  return (
    <figure
      className="relative rounded-xl premium-glass border p-6 sm:p-7 overflow-hidden"
      aria-label="Customer testimonial"
    >
      <div
        aria-hidden
        className="absolute -top-6 -right-6 h-32 w-32 rounded-full bg-primary/[0.04] blur-2xl"
      />
      <Quote className="h-6 w-6 text-primary/40 mb-3 shrink-0 relative" />
      <blockquote className="text-sm sm:text-base leading-relaxed text-foreground relative">
        &ldquo;{t.quote}&rdquo;
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3 relative">
        {t.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={t.avatar_url}
            alt={t.name}
            width={40}
            height={40}
            loading="lazy"
            decoding="async"
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <span className="text-sm font-semibold text-primary">
              {t.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t.name}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
      </figcaption>
    </figure>
  );
}
