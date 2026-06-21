import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Info, ShoppingBag } from 'lucide-react';
import { getPortalContext } from '@/lib/portal/portalContext';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { PORTAL_CARD } from '@/components/portal/portalCard';
import { formatZAR } from '@/lib/utils';
import { SHOP_PRODUCTS } from '@/config/shopProducts';

export const metadata: Metadata = {
  title: 'Add-on services',
  description: 'Once-off services you can add to your Capucor plan.',
  robots: { index: false },
};

export default async function PortalShopPage() {
  const { orgs, activeOrg } = await getPortalContext();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 lg:py-16">
      <PortalPageHeader
        title="Add-on services"
        icon={ShoppingBag}
        orgs={orgs}
        activeOrg={activeOrg}
        description="Once-off jobs that sit outside your monthly plan. We bill them separately, only when you need them."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {SHOP_PRODUCTS.map((product) => {
          const Icon = product.icon;
          return (
            <Link
              key={product.slug}
              href={`/portal/shop/${product.slug}`}
              className={`group flex flex-col p-6 ${PORTAL_CARD}`}
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 mb-4">
                <Icon className="h-5 w-5 text-primary" />
              </span>
              <h2 className="text-base font-semibold leading-snug">{product.name}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed flex-1">
                {product.summary}
              </p>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="font-mono text-lg font-bold tracking-tight">
                  {formatZAR(product.priceZAR)}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                  View
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <p className="mt-8 flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        Online checkout is on the way. For now, open any service and request it. Your accountant confirms scope and timing before any work starts.
      </p>
    </main>
  );
}
