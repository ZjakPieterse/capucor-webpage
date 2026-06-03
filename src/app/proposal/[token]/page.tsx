import type { Metadata } from 'next';
import Link from 'next/link';
import { FileSignature, BadgePercent, ShieldCheck, Clock3, Lock } from 'lucide-react';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ProposalSummary } from '@/components/pricing/ProposalSummary';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/config/site';
import type { Bracket, BracketValue, Service, Tier } from '@/types';

export const metadata: Metadata = {
  title: 'Your proposal | Capucor',
  robots: { index: false, follow: false },
};

interface ProposalRow {
  id: string;
  first_name: string;
  last_name: string;
  business_name: string;
  email: string;
  services: string[];
  brackets: Record<string, number>;
  tier_slug: string;
  monthly_total_zar: number;
  vat_zar: number;
  total_charge_zar: number;
  status: string;
  expires_at: string | null;
}

const TERMS = [
  { icon: ShieldCheck, text: 'No lock-in contract. Cancel any time with 30 days’ notice.' },
  { icon: Clock3, text: 'Billed monthly in arrears. Your first close runs at the end of the first full month.' },
  { icon: Lock, text: 'Your data stays yours. We handle it in line with POPIA at every step.' },
];

type LoadResult =
  | { ok: true; row: ProposalRow }
  | { ok: false; reason: 'invalid' | 'expired' | 'error' };

// Token-gated lookup + freshness check + Ignition-style "viewed" tracking. Kept
// out of the component body so its time/side-effect calls don't trip the
// react-hooks purity rule (server component bodies are linted as render).
async function loadProposal(token: string): Promise<LoadResult> {
  if (!token || token.length < 16) return { ok: false, reason: 'invalid' };

  // No anon RLS policy — read through the service-role admin client.
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('proposals')
    .select(
      'id, first_name, last_name, business_name, email, services, brackets, tier_slug, monthly_total_zar, vat_zar, total_charge_zar, status, expires_at',
    )
    .eq('token', token)
    .maybeSingle();

  if (error) {
    console.error('[proposal] lookup error', error);
    return { ok: false, reason: 'error' };
  }
  if (!data) return { ok: false, reason: 'invalid' };
  const row = data as unknown as ProposalRow;

  const now = Date.now();
  const expired =
    (row.expires_at && new Date(row.expires_at).getTime() < now) || row.status === 'expired';
  if (expired) {
    if (row.status === 'sent' || row.status === 'viewed') {
      await admin.from('proposals').update({ status: 'expired' }).eq('id', row.id);
    }
    return { ok: false, reason: 'expired' };
  }

  // First open: flag the proposal as viewed.
  if (row.status === 'sent') {
    await admin
      .from('proposals')
      .update({ status: 'viewed', viewed_at: new Date(now).toISOString() })
      .eq('id', row.id)
      .eq('status', 'sent');
  }

  return { ok: true, row };
}

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await loadProposal(token);
  if (!result.ok) {
    return <ProposalUnavailable reason={result.reason} />;
  }
  const row = result.row;

  // Public pricing tables for the rich line-item labels.
  const supabase = await createSupabaseServerClient();
  const [servicesRes, bracketsRes, tiersRes] = await Promise.all([
    supabase.from('services').select('*').eq('active', true).order('display_order'),
    supabase.from('brackets').select('*').eq('active', true).order('display_order'),
    supabase.from('tiers').select('*').eq('active', true).order('display_order'),
  ]);

  const services = (servicesRes.data ?? []) as Service[];
  const brackets = (bracketsRes.data ?? []) as Bracket[];
  const tiers = (tiersRes.data ?? []) as Tier[];
  const selectedBrackets = row.brackets as Record<string, BracketValue>;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 lg:py-20">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {/* Document header */}
        <div className="border-b border-border bg-primary/[0.04] p-6 sm:p-8">
          <p className="mb-4 text-base font-bold tracking-tight text-primary">Capucor</p>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Proposal
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            For {row.business_name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Prepared for {row.first_name} {row.last_name}
          </p>
        </div>

        <div className="space-y-8 p-6 sm:p-8">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Hi {row.first_name}, thanks for configuring a plan with us. Here is your proposed
            subscription. Review the details below, then sign electronically to get started — there
            is no payment required up front.
          </p>

          <ProposalSummary
            services={services}
            brackets={brackets}
            tiers={tiers}
            selectedServices={row.services}
            selectedBrackets={selectedBrackets}
            tierSlug={row.tier_slug}
            monthlyZAR={Number(row.monthly_total_zar)}
            vatZAR={Number(row.vat_zar)}
            totalZAR={Number(row.total_charge_zar)}
          />

          {/* Engagement terms */}
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              How it works
            </p>
            <ul className="space-y-2.5">
              {TERMS.map((t) => (
                <li key={t.text} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <t.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{t.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Sign + pay — Phase 2 stub */}
          <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/[0.03] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileSignature className="h-4 w-4 text-primary" />
              Sign &amp; accept
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Electronic sign-off is being finalised. For now, reply to your proposal email or book a
              call and we&rsquo;ll get your engagement started.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/15 bg-primary/[0.04] px-3 py-2 text-xs text-muted-foreground">
              <BadgePercent className="h-3.5 w-3.5 text-primary" />
              Add your payment details when you sign and unlock a discount — coming soon.
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button disabled className="gap-2">
                <FileSignature className="h-4 w-4" />
                Sign &amp; accept (coming soon)
              </Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <a href={siteConfig.links.booking} target="_blank" rel="noopener noreferrer" />
                }
              >
                Book a call
              </Button>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Questions? Reply to your proposal email or{' '}
        <Link href="/#contact" className="text-primary underline underline-offset-2">
          get in touch
        </Link>
        .
      </p>
    </div>
  );
}

function ProposalUnavailable({ reason }: { reason: 'invalid' | 'expired' | 'error' }) {
  const copy: Record<typeof reason, { title: string; body: string }> = {
    invalid: {
      title: 'Proposal not found',
      body: 'This proposal link is not recognised. Please check the link in your email, or configure a new plan.',
    },
    expired: {
      title: 'Proposal expired',
      body: 'This proposal link is no longer valid. Configure a new plan and we’ll send you a fresh one.',
    },
    error: {
      title: 'Something went wrong',
      body: 'We could not load this proposal. Please try again in a moment.',
    },
  };
  const { title, body } = copy[reason];

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <Button nativeButton={false} className="mt-6" render={<Link href="/pricing" />}>
        Build your plan
      </Button>
    </div>
  );
}
