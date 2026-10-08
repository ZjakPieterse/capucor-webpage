import { siteConfig } from '@/config/site';
import { cn } from '@/lib/utils';

/**
 * The plain line that sits beside every "Book a fit call" button, so a visitor
 * knows what they are booking before the calendar opens (Zjak, 2026-10-08,
 * funnel review F25). The button still opens siteConfig.links.booking.
 */
export function FitCallNote({ className }: { className?: string }) {
  return <p className={cn('text-xs leading-relaxed text-muted-foreground', className)}>{siteConfig.fitCallNote}</p>;
}
