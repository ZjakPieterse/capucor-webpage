import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { ConfirmSignButton } from '@/components/proposal/ConfirmSignButton';
import { Button } from '@/components/ui/button';
import { formatZAR } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Confirm your signature | Capucor',
  robots: { index: false, follow: false },
};

interface ConfirmRow {
  business_name: string;
  ref_number: string | null;
  total_charge_zar: number | string;
  status: string;
  sign_confirm_expires_at: string | null;
  pending_signature_name: string | null;
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
      'business_name, ref_number, total_charge_zar, status, sign_confirm_expires_at, pending_signature_name',
    )
    .eq('sign_confirm_token', ctoken)
    .maybeSingle();

  if (error) {
    console.error('[proposal/confirm] lookup error', error);
    return { ok: false, reason: 'error' };
  }
  if (!data) return { ok: false, reason: 'invalid' };
  const row = data as unknown as ConfirmRow;

  if (row.status === 'signed' || row.status === 'paid' || row.status === 'active') {
    return { ok: false, reason: 'signed' };
  }
  if (
    row.sign_confirm_expires_at &&
    new Date(row.sign_confirm_expires_at).getTime() < Date.now()
  ) {
    return { ok: false, reason: 'expired' };
  }
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
    <div className="mx-auto max-w-md px-6 py-16 lg:py-24">
      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Confirm &amp; sign
        </div>
        <h1 className="mt-3 text-xl font-bold tracking-tight">
          Finalise your signature for {row.business_name}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          You&rsquo;re confirming acceptance of the Capucor proposal
          {row.ref_number ? ` (${row.ref_number})` : ''}. Confirming records your signature and sets
          up your client portal. There&rsquo;s no payment needed up front.
        </p>

        <dl className="mt-5 space-y-2 rounded-xl border border-border bg-card/40 p-4 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Business</dt>
            <dd className="font-medium">{row.business_name}</dd>
          </div>
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

        <div className="mt-6">
          <ConfirmSignButton ctoken={ctoken} />
        </div>
      </div>
    </div>
  );
}

function ConfirmUnavailable({ reason }: { reason: 'invalid' | 'expired' | 'signed' | 'error' }) {
  const copy: Record<typeof reason, { title: string; body: string; showLogin?: boolean }> = {
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
      body: 'This proposal has already been signed. You can sign in to your client portal any time.',
      showLogin: true,
    },
    error: {
      title: 'Something went wrong',
      body: 'We could not load this confirmation. Please try again in a moment.',
    },
  };
  const { title, body, showLogin } = copy[reason];

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <Button
        nativeButton={false}
        className="mt-6"
        render={<Link href={showLogin ? '/login?next=/portal' : '/pricing'} />}
      >
        {showLogin ? 'Sign in to your portal' : 'Build your plan'}
      </Button>
    </div>
  );
}
