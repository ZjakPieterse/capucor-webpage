import { cn } from '@/lib/utils';
import { ScrollLitText } from '@/components/ui/ScrollLitText';

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  /** Light the subtitle up word by word on scroll (ScrollLitText). Key statements only. */
  litSubtitle?: boolean;
  align?: 'left' | 'center';
  className?: string;
}

export function SectionHeading({
  title,
  subtitle,
  litSubtitle = false,
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
      <h2 className="heading-focus text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
      {subtitle && litSubtitle && (
        <ScrollLitText
          text={subtitle}
          className="text-foreground text-xl md:text-2xl font-medium leading-snug tracking-tight max-w-3xl mx-auto pt-2"
        />
      )}
      {subtitle && !litSubtitle && (
        <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto">
          {subtitle}
        </p>
      )}
    </div>
  );
}
