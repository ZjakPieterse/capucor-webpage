import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireInternal } from '@/lib/auth/requireInternal';
import { CreateClientForm } from '@/components/internal/CreateClientForm';

// Admin-only "Add client" page. The /internal layout already gates internal
// access; creating clients is admin-only, so re-check the role here (as the org
// detail + amend pages do) and 404 for non-admins. createClientAction enforces the
// same check server-side — this is just the affordance.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Add client',
};

export default async function NewClientPage() {
  const internal = await requireInternal('/internal/clients/new');
  if (!internal || internal.role !== 'admin') notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/internal/clients"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to clients
      </Link>

      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Add client</h1>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Create a client organisation by hand: for legacy clients on older plans, or clients you
          only need to track. Internal record only, with no portal invite sent.
        </p>
      </header>

      <CreateClientForm />
    </div>
  );
}
