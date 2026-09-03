# Database — the shared Supabase project this repo does not own

> Both apps share one Supabase project. **This repo does not own the schema**, and picking the wrong Supabase client here causes silent data loss rather than an error.
>
> Extracted from `AGENTS.md` on 2026-09-03 (EH-02); the words are unchanged.
>
> Canonical agent instructions: [`../AGENTS.md`](../AGENTS.md).

---

## Database (Supabase)

Both apps share **one Supabase project**, but ⚠️ **this repo does not own the schema.**

**`supabase/migrations/` lives in [`../capucor-os`](../../capucor-os/AGENTS.md) and nowhere else** —
this repo's copy was deleted in Phase 3 of the OS split. Write new migrations there, and apply them
using the canonical OS migration workflow.

⛔ **ZJAK APPLIES EVERY MIGRATION BY HAND IN THE SUPABASE SQL EDITOR. NO AGENT APPLIES ONE, BY ANY
ROUTE** — not `supabase db push`, not `supabase db query --linked`, not a script. Standing rule,
set 2026-08-26. Write the file in `capucor-os/supabase/migrations/`, hand it over, then prove the
result with `npm run db:check` there; the proof is the writer's, not the operator's. The
reasoning is in
[`../../capucor-os/docs/engineering/prototype/DATABASE.md`](../../capucor-os/docs/engineering/prototype/DATABASE.md)
and the rule is repeated in [`../../capucor-os/AGENTS.md`](../../capucor-os/AGENTS.md).

> ⛔ **CORRECTED 2026-09-03 (EH-02). THIS FILE SAID THE OPPOSITE FOR EIGHT DAYS.** The line here
> read *"✅ `supabase db push` is allowed since 2026-08-06, from `capucor-os` and nowhere else"* —
> true when written, and false from **2026-08-26**, when the standing rule was set. It is the one
> line EH-02 did not move verbatim, because moving it would have minted a new document dated
> today that granted permission a standing safety rule forbids.
>
> ⚠️ **`db push` is not merely disallowed, it is actively dangerous here.** The remote ledger
> stopped being maintained and sits twelve versions behind production, so a push would replay
> already-applied migrations — including the destructive `034`. **Repairing the ledger does NOT
> re-open push.** The original ledger reasoning, now historical, is in
> [`../../capucor-docs/operations/migration-ledger-repair-plan.md`](../../capucor-docs/operations/migration-ledger-repair-plan.md).

⛔ **`009a` / `009b` are deliberately absent from the ledger** and must stay that way — a ledger
version with no matching local file blocks *every* push. Measured 2026-08-06.

That matters here because marketing still initiates OS-owned provisioning at signing
(`lib/portal/provision.ts` → `provision_from_signed_proposal`). See the **Schema seam** warning
under "Domain seam" before changing the RPC or its four internal tables.

Regenerate TypeScript types after a schema change:

```bash
# Replace YOUR_PROJECT_REF with your Supabase project reference ID
npm run db:types
```

Generated types land in `src/types/db.ts` and are tracked. Regenerate and commit them after schema
changes; CI rejects drift from the live schema.

### Supabase clients — pick the right one (load-bearing)

There are three server-side clients in `src/lib/supabase/`; choosing wrong causes silent data
loss, not an error:

- **`createSupabaseAnonClient()` (`anon.ts`) — for PUBLIC reads.** Cookieless; always runs as the
  `anon` role. Use for the public pricing config (`services`, `brackets`, `tiers`) and
  `testimonials` — on the pricing calculator, homepage packages teaser, proposal view, and
  server-side price math.
- **`createSupabaseServerClient()` (`server.ts`) — for per-user reads.** Cookie-bound; adopts the
  visitor's session role. Used here for lead / data-request inserts.
- **`createSupabaseAdminClient()` (`admin.ts`) — for privileged writes.** Service-role; bypasses
  RLS. Server-only mutations — provision-on-sign, the signing flow, the crons. Never import into
  browser code.

**There is no browser client in this repo.** `supabase/client.ts` went to capucor-os with `/login`
in Phase 3; every Supabase call here is server-side. Don't add one back for a marketing feature —
if a public page needs data, fetch it in a server component.

⚠️ **The public pricing tables only grant `select to anon`** (migration `001_schema.sql`, now in
capucor-os; no `to authenticated` policy). Reading them via the cookie-bound server client means a
**signed-in** visitor runs as `authenticated`, matches no policy, and silently gets **zero rows**
(no error) — which renders the calculator unavailable for logged-in users only. Always read public
data with `createSupabaseAnonClient`. Since Phase 3 there is no way to be signed in *on
capucor.com* — the session cookie belongs to capucor.app — so this trap is now much harder to
trip here. Keep the rule anyway: it costs nothing, and the same policies bite for real in
capucor-os, where signed-in staff read exactly these tables.
