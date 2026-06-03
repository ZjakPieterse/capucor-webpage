import Link from 'next/link';
import { ArrowRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/config/site';

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-32 px-6 text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 mb-6">
        <span className="font-mono text-xs font-semibold text-primary">404</span>
        <span className="text-xs text-muted-foreground">Filed under: not found</span>
      </div>

      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 max-w-xl">
        Looks like this page got filed in the wrong folder.
      </h1>

      <p className="text-muted-foreground max-w-md mb-10 leading-relaxed">
        The page you wanted doesn&rsquo;t exist or has moved. We&rsquo;re accountants &mdash; we appreciate when things are properly categorised. Help us out:
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button nativeButton={false} render={<Link href="/" />} className="gap-2">
          Back to home
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button
          nativeButton={false}
          variant="outline"
          className="gap-2"
          render={<Link href="/pricing" />}
        >
          Build your subscription
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
    </div>
  );
}
