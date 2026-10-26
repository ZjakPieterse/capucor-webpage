import type { Metadata } from 'next';
import Link from 'next/link';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { ConfirmSignButton } from '@/components/proposal/ConfirmSignButton';
import { Button } from '@/components/ui/button';
import { formatZAR } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Confirm your signature',
  robots: { index: false, follow: false },
};

interface ConfirmRow {
  business_name: string;
  ref_number: string | null;
  total_charge_zar: number | string;
  status: string;
  sign_confirm_expires_at: string | null;
  pending_signature_name: string | null;
  client_legal_name: string | null;
  signer_authority_confirmed: boolean;
}

type LoadResult =
  | { ok: true; row: ConfirmRow }
  | { ok: false; reason: 'invalid' | 'expired' | 'signed' | 'error' };

async function loadPending(ctoken: string): Promise<LoadResult> {
  if (!ctoken || ctoken.length < 16) return { ok: false, reason: 'invalid' };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('proposals')
    .select(
      'business_name, ref_number, total_charge_zar, status, sign_confirm_expires_at, pending_signature_name, client_legal_name, signer_authority_confirmed',
    )
    .eq('sign_confirm_token', ctoken)
    .maybeSingle();

  if (error) {
    console.error('[proposal/confirm] lookup error', error);
    return { ok: false, reason: 'error' };
  }
  if (!data) return { ok: false, reason: 'invalid' };
  const row: ConfirmRow = data;

  if (row.status === 'signed' || row.status === 'paid' || row.status === 'active') {
    return { ok: false, reason: 'signed' };
  }
  if (
    row.sign_confirm_expires_at &&
    new Date(row.sign_confirm_expires_at).getTime() < Date.now()
  ) {
    return { ok: false, reason: 'expired' };
  }
  // A pending signature from before the legal details were captured (005):
  // the confirm route refuses it, so ask for a fresh signature here too.
  if (!row.signer_authority_confirmed) return { ok: false, reason: 'expired' };
  return { ok: true, row };
}

export default async function ConfirmSignPage({
  params,
}: {
  params: Promise<{ ctoken: string }>;
}) {
  const { ctoken } = await params;
  const result = await loadPending(ctoken);

  if (!result.ok) {
    return <ConfirmUnavailable reason={result.reason} />;
  }
  const row = result.row;

  return (
    // Room for the signed moment's two columns on desktop; the confirm card
    // itself keeps the proposal's width (design review G2, Zjak 2026-10-26).
    <div className="mx-auto max-w-4xl px-6 py-16 lg:py-24">
      <ConfirmSignButton ctoken={ctoken}>
        <p className="text-sm font-semibold text-muted-foreground">Confirm &amp; sign</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Finalise your signature for {row.business_name}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          You&rsquo;re confirming acceptance of the Capucor proposal
          {row.ref_number ? ` (${row.ref_number})` : ''}. Confirming records your signature, and we
          email you to say it&rsquo;s signed. There&rsquo;s no payment needed up front.
        </p>

        <dl className="mt-6 space-y-2 rounded-xl border border-border bg-muted/60 p-4 text-base">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Business</dt>
            <dd className="font-medium">{row.business_name}</dd>
          </div>
          {row.client_legal_name && (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Signing for</dt>
              <dd className="text-right font-medium">{row.client_legal_name}</dd>
            </div>
          )}
          {row.pending_signature_name && (
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Signed by</dt>
              <dd className="font-medium">{row.pending_signature_name}</dd>
            </div>
          )}
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Total monthly charge</dt>
            <dd className="font-semibold">{formatZAR(Number(row.total_charge_zar))}</dd>
          </div>
        </dl>
      </ConfirmSignButton>
    </div>
  );
}

function ConfirmUnavailable({ reason }: { reason: 'invalid' | 'expired' | 'signed' | 'error' }) {
  const copy: Record<typeof reason, { title: string; body: string }> = {
    invalid: {
      title: 'Confirmation link not recognised',
      body: 'This confirmation link is not valid. It may already have been used. Open your proposal again and re-sign to get a fresh link.',
    },
    expired: {
      title: 'Confirmation link expired',
      body: 'This link is only valid for a short while. Open your proposal again and re-sign to get a fresh one.',
    },
    signed: {
      title: 'Already signed',
      body: 'This proposal has already been signed. We’ll be in touch to set up your onboarding.',
    },
    error: {
      title: 'Something went wrong',
      body: 'We could not load this confirmation. Please try again in a moment.',
    },
  };
  const { title, body } = copy[reason];

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
      {/* A signed proposal needs nothing more from the visitor. */}
      {reason !== 'signed' && (
        <Button nativeButton={false} className="mt-6" render={<Link href="/pricing" />}>
          Build your subscription
        </Button>
      )}
    </div>
  );
}
