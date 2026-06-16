import { redirect } from 'next/navigation';

// The hub has no landing of its own yet — proposals is the first (and currently
// only) page. This keeps a bare /internal visit (and the layout's post-login
// `next`) resolving instead of 404ing. Access is gated by the layout above.
export const dynamic = 'force-dynamic';

export default function InternalIndexPage() {
  redirect('/internal/proposals');
}
