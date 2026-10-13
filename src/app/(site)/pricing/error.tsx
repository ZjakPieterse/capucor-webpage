'use client';

import { useEffect } from 'react';
import { PricingUnavailable } from '@/components/pricing/PricingErrorBoundary';

// The pricing page throws at runtime when the pricing tables cannot be read
// (page.tsx), so ISR keeps serving the last good page. Only a request with
// nothing cached lands here: the fallback, plus a retry.
export default function PricingError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error('[pricing] page error:', error);
  }, [error]);

  return <PricingUnavailable onRetry={retry} />;
}
