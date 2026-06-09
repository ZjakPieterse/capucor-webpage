// Route-level loading UI for every /portal page. The portal pages are async
// server components (session check + Supabase reads), so without this the
// visitor stares at a blank screen while data loads.
export default function PortalLoading() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-12 lg:py-16" aria-busy="true">
      <div className="animate-pulse">
        {/* Header */}
        <div className="mb-10">
          <div className="h-3 w-32 rounded bg-muted mb-3" />
          <div className="h-8 w-72 rounded bg-muted" />
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-8 items-start">
          {/* Main column */}
          <div className="space-y-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-6">
                <div className="h-4 w-40 rounded bg-muted mb-5" />
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
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="h-3 w-24 rounded bg-muted mb-5" />
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
