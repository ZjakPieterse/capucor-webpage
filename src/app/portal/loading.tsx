// Route-level loading UI for every /portal page. The portal pages are async
// server components (session check + Supabase reads), so without this the
// visitor stares at a blank screen while data loads. Mirrors the hub layout
// (summary header → quick actions → two-column grid) so the swap-in is smooth.
export default function PortalLoading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12 lg:py-16" aria-busy="true">
      <div className="animate-pulse">
        {/* Summary header */}
        <div className="premium-glass mb-6 rounded-xl border border-white/10 bg-card/80 p-6 sm:p-8">
          <div className="mb-3 h-3 w-32 rounded bg-muted" />
          <div className="h-8 w-64 rounded bg-muted" />
          <div className="mt-3 h-5 w-40 rounded bg-muted" />
        </div>

        {/* Quick actions */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="premium-glass rounded-xl border border-white/10 bg-card/80 p-4"
            >
              <div className="mb-3 h-9 w-9 rounded-lg bg-muted" />
              <div className="h-3 w-20 rounded bg-muted" />
            </div>
          ))}
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
          {/* Main column */}
          <div className="space-y-6">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="premium-glass rounded-xl border border-white/10 bg-card/80 p-6"
              >
                <div className="mb-5 h-4 w-40 rounded bg-muted" />
                <div className="space-y-3">
                  <div className="h-3 w-full rounded bg-muted" />
                  <div className="h-3 w-5/6 rounded bg-muted" />
                  <div className="h-3 w-2/3 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>

          {/* Right column */}
          <aside className="space-y-6">
            <div className="premium-glass rounded-xl border border-white/10 bg-card/80 p-6">
              <div className="mb-5 h-3 w-24 rounded bg-muted" />
              <div className="space-y-3">
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-3/4 rounded bg-muted" />
              </div>
            </div>
          </aside>
        </div>
      </div>
      <span className="sr-only">Loading your portal…</span>
    </main>
  );
}
