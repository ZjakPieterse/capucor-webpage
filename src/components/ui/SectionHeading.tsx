import { cn } from '@/lib/utils';
import { TypedHeading } from '@/components/ui/TypedHeading';

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
  className?: string;
}

export function SectionHeading({
  title,
  subtitle,
  align = 'center',
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'space-y-3',
        align === 'center' && 'text-center',
        className
      )}
    >
      <TypedHeading text={title} className="text-3xl font-semibold tracking-tight md:text-h2" />
      {subtitle && (
        <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto">
          {subtitle}
        </p>
      )}
    </div>
  );
}
