'use client';

import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/config/site';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
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
  }

  override render() {
    if (this.state.hasError) {
      return <PricingUnavailable />;
    }
    return this.props.children;
  }
}

export function PricingUnavailable() {
  return (
    <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-primary mb-4">
        Pricing
      </p>
      <h1 className="text-2xl font-bold tracking-tight mb-3">
        Pricing temporarily unavailable
      </h1>
      <p className="text-muted-foreground max-w-sm mb-8 text-sm">
        Our pricing calculator is not available right now. Book a call and
        we&rsquo;ll put together a custom quote for you.
      </p>
      <Button
        nativeButton={false}
        render={
          <a
            href={siteConfig.links.booking}
            target="_blank"
            rel="noopener noreferrer"
          />
        }
        className="gap-2"
      >
        Book a fit call
      </Button>
    </div>
  );
}
