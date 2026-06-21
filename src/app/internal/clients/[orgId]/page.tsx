import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileSignature,
  FileText,
  FolderOpen,
  LineChart,
  Link2,
  Receipt,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireInternal } from '@/lib/auth/requireInternal';
import {
  getOrgFinance,
  getOrgMembers,
  getOrgProposals,
  getOrgRecord,
  getOrgSubscription,
  resolveUpcomingPayment,
} from '@/lib/portal/orgData';
import { normaliseOrgEmails } from '@/lib/internal/clientProposals';
import { OrgNamesEditor } from '@/components/internal/OrgNamesEditor';
import { PortalSummaryHeader } from '@/components/portal/PortalSummaryHeader';
import { PortalQuickActions, type PortalQuickAction } from '@/components/portal/PortalQuickActions';
import { PortalKeyDatesWidget } from '@/components/portal/PortalKeyDatesWidget';
import { PortalFinanceSnapshot } from '@/components/portal/PortalFinanceSnapshot';
import { PORTAL_PANEL } from '@/components/portal/portalCard';
import type { ProposalRow } from '@/components/internal/ProposalsTable';
import { upcomingKeyDates } from '@/config/keyDates';
import { tierDisplayName } from '@/config/tiers';
import { formatZAR } from '@/lib/utils';

// View-only staff mirror of a single client's portal Overview (PR13d → Session 6
// parity pass). Mirrors the client hub's glassy card system and surfaces almost
// everything the client sees, PLUS the proposal info staff need. Strictly
// read-only — no "act as", no client mutations; the one allowed edit is the
// admin-only OrgNamesEditor. Reads run on the SESSION client so RLS `is_internal`
// authorises them.

function formatLongDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default async function ClientOverviewPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const db = await createSupabaseServerClient();
  const base = `/internal/clients/${orgId}`;

  // The /internal layout already gated access; re-read the role here (as the
  // amend page does) to decide whether to show the admin-only names editor.
  const internal = await requireInternal(base);
  const isAdmin = internal?.role === 'admin';

  const org = await getOrgRecord(db, orgId);
  if (!org) notFound();

  const emails = normaliseOrgEmails([org.primary_contact_email]);
  const [sub, members, finance, proposals] = await Promise.all([
    getOrgSubscription(db, orgId),
    getOrgMembers(db, orgId),
    getOrgFinance(db, orgId),
    getOrgProposals(db, { orgId, emails }),
  ]);

  const keyDates = upcomingKeyDates().slice(0, 3);
  const latestProposal = proposals[0] ?? null;

  const quickActions: PortalQuickAction[] = [
    { label: 'Documents', icon: FileText, href: `${base}/documents` },
    { label: 'Billing', icon: Receipt, href: `${base}/billing` },
    { label: 'Finance', icon: LineChart, href: `${base}/finance` },
    { label: 'Proposals', icon: FileSignature, href: `${base}/proposals` },
  ];

  return (
    <div className="space-y-6">
      {/* Billing summary (org name/status/email already sit in the layout header) */}
      {sub ? (
        <PortalSummaryHeader
          tierName={tierDisplayName(sub.tier_slug)}
          status={sub.status}
          monthlyZar={Number(sub.total_charge_zar)}
          payment={resolveUpcomingPayment(sub)}
        />
      ) : (
        <section className={`${PORTAL_PANEL} p-6`}>
          <p className="text-sm text-muted-foreground">No subscription on file yet.</p>
        </section>
      )}

      {/* Quick links to the client's sub-tabs */}
      <PortalQuickActions actions={quickActions} />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Column A */}
        <div className="space-y-6">
          {/* Organisation */}
          <section className={`${PORTAL_PANEL} p-6`}>
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
              <Building2 className="h-4 w-4 text-primary" />
              Organisation
            </h2>
            <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              <Field label="Display name" value={org.display_name} />
              <Field label="Legal name" value={org.legal_name ?? '—'} />
              <Field label="Reference / slug" value={org.slug} />
              <Field label="Status" value={org.status} className="capitalize" />
              <Field label="Registration no." value={org.business_reg_no ?? '—'} />
              <Field label="Primary contact" value={org.primary_contact_email} />
              <Field label="Created" value={formatLongDate(org.created_at)} />
              <Field
                label="Xero"
                value={
                  org.xero_connected_at
                    ? `Connected ${formatLongDate(org.xero_connected_at)}`
                    : 'Not connected'
                }
              />
            </dl>

            {isAdmin && (
              <OrgNamesEditor
                orgId={org.id}
                displayName={org.display_name}
                legalName={org.legal_name}
              />
            )}
          </section>

          {/* Finance snapshot */}
          <PortalFinanceSnapshot finance={finance} href={`${base}/finance`} />

          {/* Access */}
          <section className={`${PORTAL_PANEL} p-6`}>
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
              <Users className="h-4 w-4 text-primary" />
              Access
            </h2>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No portal users linked yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {members.map((m) => (
                  <li key={m.user_id} className="flex items-center justify-between gap-4">
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {m.user_id}
                    </span>
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs capitalize">
                      {m.role}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              {members.length} portal {members.length === 1 ? 'user' : 'users'} linked to this client.
            </p>
          </section>
        </div>

        {/* Column B */}
        <div className="space-y-6">
          {/* Onboarding status (read-only — staff don't action these) */}
          <section className={`${PORTAL_PANEL} p-6`}>
            <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
              <ClipboardList className="h-4 w-4 text-primary" />
              Onboarding status
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              The client&apos;s setup state. Clients action these from their own portal.
            </p>
            <ul className="space-y-2">
              <OnboardingRow
                icon={FolderOpen}
                label="Shared Drive folder"
                done={Boolean(org.drive_folder_url)}
                doneLabel="Linked"
                pendingLabel="Not linked"
              />
              <OnboardingRow
                icon={Link2}
                label="Xero connection"
                done={Boolean(org.xero_connected_at)}
                doneLabel="Connected"
                pendingLabel="Not connected"
              />
            </ul>
          </section>

          {/* Upcoming key dates */}
          <PortalKeyDatesWidget dates={keyDates} />

          {/* Proposals summary — the staff-only view clients never see */}
          <section className={`${PORTAL_PANEL} p-6`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <FileSignature className="h-4 w-4 text-primary" />
                Latest proposal
              </h2>
              <Link
                href={`${base}/proposals`}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
              >
                All proposals
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {latestProposal ? (
              <ProposalSummary proposal={latestProposal} />
            ) : (
              <p className="text-sm text-muted-foreground">No proposals linked to this client yet.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ProposalSummary({ proposal }: { proposal: ProposalRow }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold">{proposal.ref_number ?? '—'}</span>
        {proposal.version > 1 && (
          <span className="text-xs text-muted-foreground">r{proposal.version}</span>
        )}
        <span className="rounded-full border border-border px-2 py-0.5 text-xs capitalize">
          {proposal.status}
        </span>
      </div>
      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        <Field label="Tier" value={tierDisplayName(proposal.tier_slug)} />
        <Field
          label="Monthly"
          value={formatZAR(Number(proposal.monthly_total_zar))}
          className="font-mono"
        />
        <Field label="Sent" value={formatLongDate(proposal.sent_at)} />
        <Field label="Signed" value={formatLongDate(proposal.signed_at)} />
      </dl>
      <div className="flex flex-wrap items-center gap-4 pt-1">
        <Link
          href={`/proposal/${proposal.token}`}
          target="_blank"
          className="inline-flex items-center gap-1 text-sm text-primary underline underline-offset-2"
        >
          View proposal
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
        {proposal.proposal_pdf_drive_id && (
          <Link
            href={`https://drive.google.com/file/d/${proposal.proposal_pdf_drive_id}/view`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary underline underline-offset-2"
          >
            PDF
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}

function OnboardingRow({
  icon: Icon,
  label,
  done,
  doneLabel,
  pendingLabel,
}: {
  icon: LucideIcon;
  label: string;
  done: boolean;
  doneLabel: string;
  pendingLabel: string;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-white/10 bg-background/40 px-3 py-2.5">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
        <Icon className="h-4 w-4 text-primary" />
      </span>
      <span className="text-sm font-medium">{label}</span>
      <span
        className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${
          done
            ? 'border-primary/30 bg-primary/15 text-primary'
            : 'border-border bg-muted text-muted-foreground'
        }`}
      >
        {done && <CheckCircle2 className="h-3 w-3" />}
        {done ? doneLabel : pendingLabel}
      </span>
    </li>
  );
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className={`font-medium ${className ?? ''}`}>{value}</dd>
    </div>
  );
}
