# Database — the sales-funnel schema this repo owns

> Both apps still share **one Supabase project**. Since **2026-10-07** (web-standalone, phase 1)
> **this repo owns the sales-funnel schema**; capucor-os keeps the portal tables until os-sunset.
> Picking the wrong Supabase client here causes silent data loss rather than an error.
>
> Canonical agent instructions: [`../AGENTS.md`](../AGENTS.md).

---

## What this repo owns

| Kind | Objects |
|---|---|
| Tables | `leads`, `proposals`, `brackets`, `services`, `tiers`, `data_requests`, `proposal_fulfilment`, `email_deliveries`, `proposal_ref_counters` |
| Functions | `commit_proposal_signature`, `claim_proposal_fulfilment_stage`, `finish_proposal_fulfilment_stage`, `sync_proposal_fulfilment_email`, `provision_from_signed_proposal` (removed in phase 3), `next_proposal_ref`, `proposals_set_ref`; and, until phase 4 removes their capucor.app callers, `create_proposal_amendment` / `start_proposal_resend` |
| Plus | their triggers, CHECKs, indexes, RLS policies and grants |

The starting state is recorded in
[`supabase/migrations/000_baseline_funnel.sql`](../supabase/migrations/000_baseline_funnel.sql),
consolidated from capucor-os migrations 001–065 and cross-checked column by column against
`src/types/db.ts`. ⛔ **That file is a record and is never applied** — everything in it is already
live, and its first statement raises an exception on purpose.

**Not owned here:** `client_orgs`, `client_org_members`, `subscriptions` and every other portal
table; the RLS helpers `is_internal()` / `has_client_access()`; `tier_inclusions`. ⚠️
`testimonials` is read here (homepage, anon client) but was left out of the baseline — an open
question, not a decision.

### Links across the line (until os-sunset)

- `proposals.client_org_id` → `client_orgs(id)`. Written by `provision_from_signed_proposal`
  until phase 3; afterwards left unused, not dropped.
- capucor-os also writes `email_deliveries` (`outbound_request_emails.delivery_id` points at it),
  so a change to that table must not break capucor-os.
- `set_updated_at()` is shared with portal tables. Never drop or rename it from here.
- The staff policy `internal_select_proposals` calls portal helpers. Drop it at os-sunset.

## Writing a migration

1. Write it in **this repo's** `supabase/migrations/`, numbered from `001_…` (the baseline is
   `000`). ⛔ Never write a funnel migration in capucor-os again.
2. Head it with what it changes, why, pre-flight and verify queries, and a rollback — as
   capucor-os `065` does.
3. ⚠️ **Price changes are new `brackets` rows, never edits.** Proposals store bracket ordinals and
   re-pricing does not filter on `active`, so editing a live row re-prices every unsigned
   proposal. Issue a new ladder and retire the old rows (see the baseline's `brackets` note).
4. Hand it to Zjak. Code that depends on it ships only after Zjak confirms it is applied.

⛔ **ZJAK APPLIES EVERY MIGRATION BY HAND IN THE SUPABASE SQL EDITOR. NO AGENT APPLIES ONE, BY
ANY ROUTE** — not `supabase db push`, not `supabase db query --linked`, not a script. Standing
rule since 2026-08-26.

⛔ **Never use `supabase db push`.** It is not merely disallowed, it is dangerous: the remote
migration ledger stopped being maintained and has drifted from production, so a push would replay
migrations that are already applied — some of them destructive. Repairing the ledger does not
re-open push.

## Types

`src/types/db.ts` is **generated in this repo** (since 2026-10-07, web-standalone phase 2) and is
not pinned or compared with capucor-os. After Zjak confirms a funnel migration is applied, run
`npm run db:types` and commit the regenerated file with the code that uses it.

- It needs `npx supabase login` on the machine. ⚠️ A `SUPABASE_ACCESS_TOKEN` environment variable
  takes precedence over the login; a stale one fails with `Unauthorized`.
- ⚠️ If the CLI fails, the shell redirect still truncates `src/types/db.ts` and writes an error
  into it — restore it with `git checkout src/types/db.ts`.
- The file covers the whole shared project, portal tables included, so a capucor-os migration
  also shows up in the next regeneration. That is expected; commit it.

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

**There is no browser client in this repo.** Every Supabase call here is server-side. Don't add
one for a marketing feature — if a public page needs data, fetch it in a server component.

⚠️ **The public pricing tables only grant `select to anon`** (no `to authenticated` policy; see
the baseline). Reading them via the cookie-bound server client means a **signed-in** visitor runs
as `authenticated`, matches no policy, and silently gets **zero rows** (no error) — which renders
the calculator unavailable for logged-in users only. Always read public data with
`createSupabaseAnonClient`. There is no way to be signed in *on capucor.com* today; keep the rule
anyway, it costs nothing.
