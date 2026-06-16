import type { SubscriptionStatus } from '@/types';

// Subscription status pill, shared by the portal home, billing page, and the
// internal client view. Accepts a raw DB string and falls back to the
// pending-payment style for anything unexpected.
const STYLES: Record<SubscriptionStatus, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-primary/15 text-primary border-primary/30' },
  pending_payment: { label: 'Pending payment', cls: 'bg-warning/15 text-warning border-warning/30' },
  cancelling: { label: 'Cancelling', cls: 'bg-warning/15 text-warning border-warning/30' },
  cancelled: { label: 'Cancelled', cls: 'bg-muted text-muted-foreground border-border' },
  past_due: { label: 'Past due', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
};

export function SubscriptionStatusBadge({ status }: { status: string }) {
  const s = STYLES[status as SubscriptionStatus] ?? STYLES.pending_payment;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${s.cls}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}
