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
npm run build:cf:offline  # The same build, with NO credentials — see below
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

---

## Proving a Cloudflare build without credentials

> **Added 2026-09-04 (AE-03).** Everything above the `Deployment & operational rules` heading
> is the extracted `AGENTS.md` text; this section is new work.

```bash
npm run build:cf:offline    # the whole OpenNext/Cloudflare build, no credentials involved
```

`npm run build:cf` reads `.env.local` on the dev box, so the credential-restricted sandbox that
does most of the engineering here could never run it. That left the **most fragile step in this
stack** — OpenNext bundling a Next build into a working worker — with no local proof at all: a
dependency bump or a `next.config.ts` edit could only be found to break the bundle after it was
pushed.

[`scripts/build-cf-offline.mjs`](../scripts/build-cf-offline.mjs) closes that without relaxing the
boundary. It copies the tree into a disposable OS-temp snapshot, runs `npm ci` and `build:cf`
there with obviously-synthetic `.invalid` placeholder values, and deletes the snapshot on success
**and** on failure.

**Three independent guards keep credentials out**, because one of them failing silently is exactly
the shape of bug that matters:

1. **Structural** — the copy set is `git ls-files --cached --others --exclude-standard`. `.gitignore`
   already excludes `.env*`, so those are excluded by construction rather than by a list somebody
   has to keep current.
2. **Explicit** — a deny-filter drops dotenv, `.dev.vars`, `.npmrc` and key material by name anyway,
   including the tracked `.env.example`.
3. **Asserted** — the snapshot is walked before *and* after the build and the run **fails** if any
   dotenv-shaped file is present.

The child environment is scrubbed too: every credential-shaped variable name is deleted before the
placeholders are set, so an exported `SUPABASE_SERVICE_ROLE_KEY` cannot ride past the file guards.

⚠️ **Hand-synced with `../capucor-os/scripts/build-cf-offline.mjs`** and its guards module beside
it. Both repositories build the same way and need the same boundary.

### ⚠️ What it proves, and what it does not

- **It proves build compatibility.** The tree still compiles, bundles and packages into a worker.
- **It proves nothing about production.** Not configuration, not real secrets, not Worker bindings,
  not live behaviour. The values are fake, so the artefact is **not deployable** — and a Windows
  build is runtime-broken regardless (see the deploy rules above). `build:cf` in
  `.github/workflows/deploy.yml`, with real repository secrets, is still the only build that ships.
- **It needs the npm registry**, because it runs `npm ci` in the snapshot. "Offline" here means
  *credential-free*, not *network-free*.
- **The client-bundle half of its final assertion is skipped in this repository, correctly.** The
  browser Supabase client went to capucor-os with `/login` in Phase 3, so nothing here inlines the
  Supabase URL into the client bundle — the same fact that removed the client-asset grep from this
  repo's `deploy.yml`. The check arms itself if `src/lib/supabase/client.ts` ever appears. The
  server-bundle half runs in both repositories, because `next.config.ts` bakes the Supabase URL
  into the CSP.
- **The static build logs three failed `[pricing]` fetches.** That is the placeholder Supabase host
  refusing to resolve, which is the point of using a reserved `.invalid` domain. The page falls
  back and the build completes; it is not a regression.

---

## Knowing which commit production is serving

> **Added 2026-09-04 (AE-05).**

The **signed** `/api/health` response carries `release`: the full git SHA the running bundle was
built from. The **public** response is unchanged and still exactly `{ ok, app }` — repository
state is not something anonymous callers get.

`next.config.ts` defines `process.env.CAPUCOR_RELEASE` into the **server** webpack compilation
only, so the SHA is a literal in the compiled worker. It is deliberately **not** a Worker secret:
a secret is set by hand and can be edited to say anything, which would make the check a statement
about the dashboard rather than about the artefact that was uploaded.

`deploy.yml` uses it twice:

| When | Gate |
| --- | --- |
| **Before deploying** | The SHA must be in `.open-next/server-functions` **and absent from `.open-next/assets`**. A leak into the public assets refuses the deploy. |
| **After deploying** | Signs a health request and fails the run unless the returned `release` equals the SHA just shipped. The verdict lives in [`scripts/release-provenance.mjs`](../scripts/release-provenance.mjs) so every case has a unit test. |

All three post-deploy steps are conditioned on the deploy having succeeded rather than on the
step above them, so **the first failure no longer skips the rest** — the incident where that
matters is precisely the one with several faults at once.

### ⚠️ What this proves

That the expected revision was serving **immediately after that deploy**. It does **not**
continuously detect a later rollback: nothing re-asks the question, and giving the push-triggered
watchdog the key needed to ask is a trade the cross-repo contract deliberately refused.

### ⚠️ A hand-run `npm run deploy:cf` now reports `release: "unknown"`

Nothing outside `deploy.yml` sets `CAPUCOR_RELEASE`, so a laptop deploy produces a worker that
cannot say what it is. That is the **right** outcome — it makes the laptop deploy this page
already forbids visibly distinguishable from a real one — but do not read `unknown` as a bug in
the injection without checking how the running bundle was built.

> ⛔ **This supersedes the suggestion above** of comparing the two Workers by CSS/chunk hash on
> their `*.workers.dev` URLs. That was a proxy for "which build is this?"; the signed
> `release` field answers it directly, and exactly.

### Rehearsing it locally

```bash
npm run build:cf:offline
```

The credential-free build sets a synthetic release and asserts both halves of the pre-deploy gate
— present in the server bundle, absent from the public assets. So a broken injection is caught on
the dev box rather than by capucor-web's first production dispatch.
