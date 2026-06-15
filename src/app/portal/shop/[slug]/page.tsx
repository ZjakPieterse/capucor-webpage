import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Check, CalendarClock, Mail, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { requireSession } from '@/lib/auth/requireSession';
import { siteConfig } from '@/config/site';
import { formatZAR } from '@/lib/utils';
import { getShopProduct } from '@/config/shopProducts';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getShopProduct(slug);
  return {
    title: product ? product.name : 'Add-on services',
    description: product?.summary,
    robots: { index: false },
  };
}

const REQUEST_EMAIL = 'info@capucor.com';

export default async function PortalShopProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireSession();
  const { slug } = await params;
  const product = getShopProduct(slug);

  if (!product) {
    return <ProductNotFound />;
  }

  const Icon = product.icon;
  const mailto = `mailto:${REQUEST_EMAIL}?subject=${encodeURIComponent(
    `Add-on request: ${product.name}`,
  )}&body=${encodeURIComponent(
    `Hi Capucor,\n\nI'd like to request the following add-on service: ${product.name}.\n\nThanks,`,
  )}`;

  return (
    <main className="max-w-2xl mx-auto px-6 py-12 lg:py-16">
      <Link
        href="/portal/shop"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All add-on services
      </Link>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border bg-primary/[0.04] p-6 sm:p-8">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 mb-4">
            <Icon className="h-5 w-5 text-primary" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{product.name}</h1>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tracking-tight">
              {formatZAR(product.priceZAR)}
            </span>
            <span className="text-xs text-muted-foreground">once-off</span>
          </div>
        </div>

        <div className="space-y-8 p-6 sm:p-8">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {product.description}
          </p>

          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              What&rsquo;s included
            </p>
            <ul className="space-y-2.5">
              {product.includes.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4 shrink-0 text-primary" />
            <span>
              <span className="font-medium text-foreground">Turnaround:</span> {product.turnaround}
            </span>
          </div>

          {/* Request — checkout (B4/B5) is a Phase-2 stub */}
          <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/[0.03] p-5">
            <p className="text-sm font-semibold">Request this service</p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Online checkout is coming. For now, send the request and your accountant confirms scope, timing and the final quote before any work starts — no charge until you say go.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button
                nativeButton={false}
                className="gap-2"
                render={<a href={mailto} />}
              >
                <Mail className="h-4 w-4" />
                Request by email
              </Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <a href={siteConfig.links.booking} target="_blank" rel="noopener noreferrer" />
                }
              >
                Book a call instead
              </Button>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-6 flex items-start justify-center gap-2 text-center text-xs text-muted-foreground leading-relaxed">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        Prices are indicative. Your accountant confirms the final quote for your specific situation.
      </p>
    </main>
  );
}

function ProductNotFound() {
  return (
    <main className="max-w-md mx-auto px-6 py-16 lg:py-24 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Service not found</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        We couldn&rsquo;t find that add-on service. It may have been renamed or removed.
      </p>
      <Button nativeButton={false} className="mt-6" render={<Link href="/portal/shop" />}>
        Browse add-on services
      </Button>
    </main>
  );
}
