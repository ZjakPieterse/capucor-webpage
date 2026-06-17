# Signed-proposal PDF archiver (PR10)

When a client signs a proposal, the Capucor site renders the signed document to HTML and POSTs it
to a small Google Apps Script Web App, which converts it to PDF and files it in the firm's central
**Internal Drive** folder (a Google **Shared Drive**). The signed proposal is the legal debit-order
mandate, so this is its durable archival record.

The site never talks to Drive directly — the script runs as its owner and already has Drive access,
so there is **no service account or key on the site**. The only shared state is a secret string.

[`archive-proposal.gs`](./archive-proposal.gs) is the source; paste it into the Apps Script project.

## One-time setup

1. **Shared Drive folder.** In Google Drive → Shared drives, create (or pick) the firm Shared Drive
   and an **Internal Drive** folder for signed proposals. Open it and copy the **folder id** from the
   URL (`https://drive.google.com/drive/folders/<FOLDER_ID>`).

2. **Create the script.** Go to <https://script.google.com> (signed in as `zjak@capucor.com`),
   New project, and paste the contents of `archive-proposal.gs`.

3. **Enable the Advanced Drive Service.** In the editor: **Services** (＋) → **Drive API** → Add.
   It must appear as the identifier `Drive` (this is what writes to a Shared Drive reliably).

4. **Script properties.** Project Settings (gear) → **Script properties** → add two:
   - `FOLDER_ID` = the Shared Drive folder id from step 1
   - `SHARED_SECRET` = a long random string (e.g. `openssl rand -hex 32`)

5. **Deploy as a Web app.** Deploy → **New deployment** → type **Web app**:
   - *Execute as*: **Me** (`zjak@capucor.com`)
   - *Who has access*: **Anyone** — the `SHARED_SECRET` is the real gate, not Google sign-in.
   - Deploy, authorise the scopes, and copy the **Web app URL** (ends in `/exec`).

6. **Cloudflare secrets.** On the Capucor Worker set:
   - `APPS_SCRIPT_PDF_URL` = the `/exec` URL
   - `APPS_SCRIPT_PDF_SECRET` = the same value as `SHARED_SECRET`

   Until both are set, the site silently skips archival (signing/provisioning still work).

## Request / response contract

The site POSTs JSON:

```json
{ "secret": "…", "refNumber": "FT-2026-06-0042", "businessName": "Pat Trading Co",
  "filename": "FT-2026-06-0042 - Pat Trading Co - signed proposal.pdf", "html": "<!doctype html>…" }
```

The script replies:

```json
{ "ok": true, "fileId": "1AbC…", "fileUrl": "https://drive.google.com/file/d/1AbC…/view" }
```

On any problem it replies `{ "ok": false, "error": "…" }` and the site leaves the proposal
un-archived (the owner email flags it); a later sign or backfill can retry.

## Re-deploying after editing the script

Apps Script Web Apps are versioned. After changing `archive-proposal.gs`, use **Deploy → Manage
deployments → (edit) → New version** so the existing `/exec` URL keeps working — no Cloudflare change
needed.
