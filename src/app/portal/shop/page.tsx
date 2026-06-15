import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Info } from 'lucide-react';
import { requireSession } from '@/lib/auth/requireSession';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatZAR } from '@/lib/utils';
import { SHOP_PRODUCTS } from '@/config/shopProducts';

export const metadata: Metadata = {
  title: 'Add-on services',
  description: 'Once-off services you can add to your Capucor plan.',
  robots: { index: false },
};

export default async function PortalShopPage() {
  const user = await requireSession();
  const supabase = createSupabaseAdminClient();

  const { data: membership } = await supabase
    .from('client_org_members')
    .select('client_org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  let orgName: string | null = null;
  if (membership) {
    const { data: org } = await supabase
      .from('client_orgs')
      .select('name')
      .eq('id', membership.client_org_id)
      .maybeSingle();
    orgName = (org?.name as string | undefined) ?? null;
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-12 lg:py-16">
      <Link
        href="/portal"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to portal
      </Link>

      <header className="mb-8">
        {orgName && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            {orgName}
          </p>
        )}
        <h1 className="text-3xl font-bold tracking-tight">Add-on services</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-prose">
          Once-off jobs that sit outside your monthly plan — billed separately, only when you need them.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {SHOP_PRODUCTS.map((product) => {
          const Icon = product.icon;
          return (
            <Link
              key={product.slug}
              href={`/portal/shop/${product.slug}`}
              className="service-card group rounded-xl border border-border bg-card p-6 flex flex-col"
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
        Online checkout is on the way. For now, open any service and request it — your accountant confirms scope and timing before any work starts.
      </p>
    </main>
  );
}
