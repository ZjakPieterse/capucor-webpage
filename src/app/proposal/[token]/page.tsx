import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseAnonClient } from '@/lib/supabase/anon';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/getClientIp';
import { ProposalSummary } from '@/components/pricing/ProposalSummary';
import { ProposalSignForm } from '@/components/proposal/ProposalSignForm';
import {
  DocumentHeader,
  ScheduleOfServices,
  FeesNotes,
  FeeChangesSection,
  ResponsibilitiesSection,
  TermsBlocks,
} from '@/components/proposal/ProposalSections';
import { Button } from '@/components/ui/button';
import { cumulativeInclusions, buildFairUsage, outOfScopeItems } from '@/lib/schedule';
import {
  PROPOSAL_TERMS,
  INLINE_TERM_IDS,
  RESPONSIBILITIES_OURS,
  RESPONSIBILITIES_YOURS,
} from '@/config/proposalTerms';
import type { Bracket, BracketValue, Service, Tier } from '@/types';

export const metadata: Metadata = {
  title: 'Your proposal | Capucor',
  robots: { index: false, follow: false },
};

interface ProposalRow {
  id: string;
  ref_number: string | null;
  version: number;
  first_name: string;
  last_name: string;
  business_name: string;
  email: string;
  services: string[];
  brackets: Record<string, number>;
  tier_slug: string;
  addons: string[] | null;
  monthly_total_zar: number;
  vat_zar: number;
  total_charge_zar: number;
  status: string;
  sent_at: string | null;
  expires_at: string | null;
  signed_at: string | null;
  signature_name: string | null;
  signature_method: string | null;
  signature_image: string | null;
}

const SIGNED_STATUSES = new Set(['signed', 'paid', 'active']);

type LoadResult =
  | { ok: true; row: ProposalRow }
  | { ok: false; reason: 'invalid' | 'expired' | 'error' | 'ratelimited' };

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
      'id, ref_number, version, first_name, last_name, business_name, email, services, brackets, tier_slug, addons, monthly_total_zar, vat_zar, total_charge_zar, status, sent_at, expires_at, signed_at, signature_name, signature_method, signature_image',
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

  // A superseded proposal has been replaced by a newer revision.
  if (row.status === 'superseded') return { ok: false, reason: 'expired' };

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

  // View rate-limit (defense-in-depth). A separate, generous bucket so it never
  // collides with the 10/10-min sign/leads bucket or throttles a normal re-read;
  // it just caps abusive scraping of the token URL.
  const h = await headers();
  const ip = getClientIp(h);
  const { allowed } = await checkRateLimit(ip, { key: 'pview', limit: 40 });
  if (!allowed) {
    return <ProposalUnavailable reason="ratelimited" />;
  }

  const result = await loadProposal(token);
  if (!result.ok) {
    return <ProposalUnavailable reason={result.reason} />;
  }
  const row = result.row;

  // Once signed, the public token view is intentionally minimal: a leaked link
  // must not expose the full document, fees, or the signature image (those live
  // in the client portal, the owner email, and the Drive archive). Just confirm
  // acceptance and point to the portal.
  if (SIGNED_STATUSES.has(row.status)) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 lg:py-24">
        <SignedConfirmation row={row} />
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

  // Public pricing tables for the rich line-item labels — read as `anon` so the
  // proposal renders correctly even when the viewer is signed in.
  const supabase = createSupabaseAnonClient();
  const [servicesRes, bracketsRes, tiersRes] = await Promise.all([
    supabase.from('services').select('*').eq('active', true).order('display_order'),
    supabase.from('brackets').select('*').eq('active', true).order('display_order'),
    supabase.from('tiers').select('*').eq('active', true).order('display_order'),
  ]);

  const services = (servicesRes.data ?? []) as Service[];
  const brackets = (bracketsRes.data ?? []) as Bracket[];
  const tiers = (tiersRes.data ?? []) as Tier[];
  const selectedBrackets = row.brackets as Record<string, BracketValue>;

  // Derived schedule + terms (config-driven; see lib/schedule.ts).
  const inclusions = cumulativeInclusions(row.services, row.tier_slug);
  const fairUsage = buildFairUsage(row.services, selectedBrackets, brackets);
  const outOfScope = outOfScopeItems(row.services, services);
  const debitBlock = PROPOSAL_TERMS.find((b) => b.id === 'debit-order');
  const inlineIds = INLINE_TERM_IDS as readonly string[];
  const inlineTerms = PROPOSAL_TERMS.filter((b) => inlineIds.includes(b.id));

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 lg:py-20">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <DocumentHeader
          businessName={row.business_name}
          firstName={row.first_name}
          lastName={row.last_name}
          refNumber={row.ref_number}
          sentAt={row.sent_at}
          expiresAt={row.expires_at}
          version={row.version}
        />

        <div className="space-y-8 p-6 sm:p-8">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Hi {row.first_name}, here&apos;s your proposed plan. Everything we&apos;ll do, what it
            costs, and the terms are set out below. Review it, then sign at the bottom to get started.
            There&apos;s no payment needed up front.
          </p>

          <ScheduleOfServices
            inclusions={inclusions}
            fairUsage={fairUsage}
            outOfScope={outOfScope}
          />

          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Your fees
            </p>
            <ProposalSummary
              services={services}
              brackets={brackets}
              tiers={tiers}
              selectedServices={row.services}
              selectedBrackets={selectedBrackets}
              tierSlug={row.tier_slug}
              selectedAddons={row.addons ?? []}
              monthlyZAR={Number(row.monthly_total_zar)}
            />
            <FeesNotes />
          </div>

          <FeeChangesSection fairUsage={fairUsage} />

          <ResponsibilitiesSection ours={RESPONSIBILITIES_OURS} yours={RESPONSIBILITIES_YOURS} />

          {/* Debit-order authorisation. Signing authorises collection; bank
              details are arranged directly at onboarding, never captured on the site. */}
          {debitBlock && (
            <div className="rounded-xl border border-border bg-card/40 p-5">
              <h2 className="text-sm font-semibold">{debitBlock.heading}</h2>
              {debitBlock.paragraphs.map((p, i) => (
                <p key={i} className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
            </div>
          )}

          {/* Key terms inline + link to the full engagement terms. */}
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Terms
            </p>
            <TermsBlocks blocks={inlineTerms} />
            <p className="mt-4 text-xs text-muted-foreground">
              These are the key points. Read the{' '}
              <Link
                href="/terms/engagement"
                className="text-primary underline underline-offset-2"
                target="_blank"
              >
                full engagement terms
              </Link>{' '}
              — signing accepts them in full.
            </p>
          </div>

          {/* Sign & accept (signed proposals are handled by the minimal view above). */}
          <ProposalSignForm
            token={token}
            defaultName={`${row.first_name} ${row.last_name}`.trim()}
          />
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

      {row.status === 'active' ? (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            Thanks, that&rsquo;s accepted. Your client portal is ready. Sign in any time to see your
            plan, key dates and documents. Someone from the Capucor team will be in touch shortly to
            set up your onboarding.
          </p>
          <Button
            nativeButton={false}
            className="mt-5"
            render={<Link href="/login?next=/portal" />}
          >
            Sign in to your portal
          </Button>
        </>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Thanks, there&rsquo;s nothing more you need to do right now. Someone from the Capucor team
          will be in touch shortly to set up your onboarding.
        </p>
      )}
    </div>
  );
}

function ProposalUnavailable({
  reason,
}: {
  reason: 'invalid' | 'expired' | 'error' | 'ratelimited';
}) {
  const copy: Record<typeof reason, { title: string; body: string }> = {
    invalid: {
      title: 'Proposal not found',
      body: 'This proposal link is not recognised. Please check the link in your email, or configure a new plan.',
    },
    expired: {
      title: 'Proposal expired',
      body: 'This proposal link is no longer valid. Configure a new plan and we’ll send you a fresh one.',
    },
    ratelimited: {
      title: 'Please try again shortly',
      body: 'This proposal was opened a lot in a short time. Wait a few minutes and refresh.',
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
