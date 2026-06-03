'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Calendar, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/config/site';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[app] Uncaught render error:', error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-32 px-6 text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 mb-6">
        <span className="font-mono text-xs font-semibold text-primary">500</span>
        <span className="text-xs text-muted-foreground">Something went sideways</span>
      </div>

      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 max-w-xl">
        We&rsquo;ve hit an unexpected snag.
      </h1>

      <p className="text-muted-foreground max-w-md mb-10 leading-relaxed">
        Try again, head back home, or book a quick call &mdash; we&rsquo;ll take it from there.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={reset} className="gap-2">
          <RotateCw className="h-4 w-4" />
          Try again
        </Button>
        <Button nativeButton={false} variant="outline" render={<Link href="/" />} className="gap-2">
          Back to home
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button
          nativeButton={false}
          variant="ghost"
          className="gap-2"
          render={
            <a
              href={siteConfig.links.booking}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          <Calendar className="h-4 w-4" />
          Book a fit call
        </Button>
      </div>

      {error.digest && (
        <p className="mt-8 text-[10px] uppercase tracking-widest text-muted-foreground/70 font-mono">
          ref: {error.digest}
        </p>
      )}
    </div>
  );
}
