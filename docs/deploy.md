# Build and deploy — capucor.com

> How this repo is built for Cloudflare Workers and how it reaches production.
>
> ⛔ **Read the deployment rules before deploying.** They are hard-won and load-bearing — ignoring them has taken production down. Extracted from `AGENTS.md` on 2026-09-03 (EH-02); the words are unchanged.
>
> Canonical agent instructions: [`../AGENTS.md`](../AGENTS.md).

---

## Build & Deploy (Cloudflare)

```bash
npm run build:cf     # Build for Cloudflare Workers
npm run preview:cf   # Build and run local Cloudflare preview
npm run deploy:cf    # Build and deploy to Cloudflare Workers (see deploy rules below)
```

The Cloudflare target is configured in `wrangler.jsonc` and `open-next.config.ts`.

### ⚠️ Deployment & operational rules (read before deploying)

These are hard-won and load-bearing — ignoring them has taken production down:

- **Deploy to prod by MANUAL DISPATCH ONLY.** `.github/workflows/deploy.yml` runs the
  secrets-driven `build:cf` + `wrangler deploy` on Ubuntu. It triggers on `workflow_dispatch`
  alone and refuses to run unless you type `deploy` into its `confirm` input.
- **Merging to `master` no longer ships anything.** `ci.yml` validates and stops; it has no deploy
  step and must never get one. A merged fix is NOT a shipped fix here any more, so someone has to
  remember to dispatch the deploy. This is deliberate (ADR 0010 part 1, extending ADR 0003 to this
  repo) and it removed an unattended path from merge to a live surface handling signed engagements
  and debit-order mandates.
- **NEVER run `npm run deploy:cf` from the Windows dev box.** OpenNext's Windows build produces
  a runtime-broken worker (`ChunkLoadError` on every server route). If a bad deploy ships,
  recover with **`wrangler rollback`**.
- **The build is pinned to webpack** (`next build --webpack`), not Turbopack — OpenNext-for-
  Cloudflare cannot bundle a Turbopack build into a working worker.
- **The coupled runtime is pinned exact:** Next.js / `eslint-config-next` **16.3.0**,
  `@opennextjs/cloudflare` **1.20.2** and Wrangler **4.86.0**. Move them together and verify a full
  `build:cf`; a caret on OpenNext previously allowed a clean install to select an adapter whose
  Next peer range the app did not satisfy.
- **No edge-runtime routes.** Cloudflare Workers are already edge; do not add
  `export const runtime = 'edge'` (it breaks the OpenNext bundle — e.g. `/api/og` had it removed).
- **ISR caching:** `/` and `/pricing` are cached for 1 hour (`export const revalidate = 3600`)
  via the OpenNext KV incremental cache (`open-next.config.ts` + the `NEXT_INC_CACHE_KV` binding
  in `wrangler.jsonc`). After editing pricing in Supabase, refresh them immediately with
  `POST /api/revalidate?secret=<REVALIDATE_SECRET>` (GET also works for browser use). Do not add
  `revalidate` to `/proposal/[token]` — it mutates status on view.
- Prod smoke-check: `curl -sD- -o /dev/null https://capucor.com/pricing | grep -i content-security-policy`
  should show the Supabase host in `connect-src`. `deploy.yml` runs this same check post-deploy.
  **Don't point it at capucor.app** — that is a different Worker from a different repo, so it would
  report capucor-os's health, not this deploy's.
