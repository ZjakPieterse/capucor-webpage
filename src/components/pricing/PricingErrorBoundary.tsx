'use client';

import { Component, type ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/config/site';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// A page opened before a deploy can ask for a code chunk the new deploy no
// longer serves. That is not a broken calculator: reload once to pick up the
// new build instead of showing "unavailable" (Zjak saw it on 2026-10-13,
// moving from /contact to /pricing around a deploy). The flag stops a loop if
// the chunk is genuinely missing.
const RELOAD_FLAG = 'pricing-chunk-reload';

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === 'ChunkLoadError' ||
    /Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
      error.message,
    )
  );
}

export class PricingErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown) {
    console.error('[PricingCalculator] Uncaught error:', error);
    if (!isChunkLoadError(error)) return;
    try {
      if (sessionStorage.getItem(RELOAD_FLAG)) return;
      sessionStorage.setItem(RELOAD_FLAG, '1');
    } catch {
      return;
    }
    window.location.reload();
  }

  override componentDidMount() {
    // A clean render clears the flag, so a later deploy can reload again.
    try {
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {
      // Storage blocked: the reload guard simply never arms.
    }
  }

  override render() {
    if (this.state.hasError) {
      return <PricingUnavailable />;
    }
    return this.props.children;
  }
}

/** `onRetry`: the route error page's retry (app/(site)/pricing/error.tsx). */
export function PricingUnavailable({ onRetry }: { onRetry?: () => void } = {}) {
  return (
    <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight mb-3">
        Pricing temporarily unavailable
      </h1>
      <p className="text-muted-foreground max-w-sm mb-8 text-sm">
        Our pricing calculator is not available right now. Book a call and
        we&rsquo;ll put together a custom quote for you.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        {onRetry && (
          <Button variant="outline" onClick={onRetry} className="gap-2">
            <RotateCw className="h-4 w-4" aria-hidden /> Try again
          </Button>
        )}
        <Button
          nativeButton={false}
          render={
            <a
              href={siteConfig.links.fitCall}
            />
          }
          className="gap-2"
        >
          Book a fit call
        </Button>
      </div>
    </div>
  );
}
