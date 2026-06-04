import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, ShieldCheck, Clock3, Lock } from 'lucide-react';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ProposalSummary } from '@/components/pricing/ProposalSummary';
import { ProposalSignForm } from '@/components/proposal/ProposalSignForm';
import { Button } from '@/components/ui/button';
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
  signed_at: string | null;
  signature_name: string | null;
  signature_method: string | null;
  signature_image: string | null;
}

const SIGNED_STATUSES = new Set(['signed', 'paid', 'active']);

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
      'id, first_name, last_name, business_name, email, services, brackets, tier_slug, monthly_total_zar, vat_zar, total_charge_zar, status, expires_at, signed_at, signature_name, signature_method, signature_image',
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
  // Only pre-signature proposals expire. Once signed, the link stays valid so
  // the client can revisit their accepted proposal regardless of expires_at.
  const isPreSigned = row.status === 'sent' || row.status === 'viewed';
  const expired =
    row.status === 'expired' ||
    (isPreSigned && !!row.expires_at && new Date(row.expires_at).getTime() < now);
  if (expired) {
    if (isPreSigned) {
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

          {/* Sign & accept */}
          {SIGNED_STATUSES.has(row.status) ? (
            <SignedConfirmation row={row} />
          ) : (
            <ProposalSignForm
              token={token}
              defaultName={`${row.first_name} ${row.last_name}`.trim()}
            />
          )}
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

function SignedConfirmation({ row }: { row: ProposalRow }) {
  const signedOn = row.signed_at
    ? new Date(row.signed_at).toLocaleDateString('en-ZA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Check className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">Proposal accepted</p>
          {signedOn && (
            <p className="text-xs text-muted-foreground">
              Signed{row.signature_name ? ` by ${row.signature_name}` : ''} on {signedOn}
            </p>
          )}
        </div>
      </div>

      {row.signature_image && (
        <div className="mt-4 flex items-center justify-center overflow-hidden rounded-lg border border-input bg-white p-3">
          {/* Stored signature image (a normalised PNG data URL). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={row.signature_image} alt="Signature" className="max-h-28" />
        </div>
      )}

      <p className="mt-4 text-sm text-muted-foreground">
        Thanks — there&rsquo;s nothing more you need to do right now. Someone from the Capucor team
        will be in touch shortly to set up your onboarding.
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
