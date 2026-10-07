# Payments status

> The billing model changed on 2026-06-17 and the code has not caught up in one direction and never will in the other. **Read this before touching payment code.**
>
> Extracted from `AGENTS.md` on 2026-09-03 (EH-02); the words are unchanged.
>
> Canonical agent instructions: [`../AGENTS.md`](../AGENTS.md).

---

## Payments status (billing model changed — read before touching payment code)

The original plan wired **Paystack** for both subscriptions and shop checkout. The **2026-06-17
billing decision** changed that:

- **Subscriptions** are collected via **Paysoft Flow** (Xero-integrated bulk debit orders). It has
  **no developer API**, so billing is set up **by hand** in Xero/Paysoft Flow — the signed proposal
  is the debit-order mandate and **no banking details are captured on the site**. Signing stops at
  `signed` + the signed PDF in Drive (web-standalone phase 3, 2026-10-07); the owner email, with
  the Drive link, is the cue to set up billing. There is no payment webhook and no portal record.
- **Shop one-offs** will use **PayFast** (signed redirect + an ITN webhook validated by MD5
  signature + a server postback) — not yet wired in code.

⛔ **There is no Paystack code here.** It was deleted on 2026-08-01 and **none of it is worth
resurrecting** — the shop needs PayFast's ITN/MD5 scheme, not Paystack's HMAC-SHA512, and
subscriptions are set up by hand from the signed proposal rather than by a payment webhook.
Git history keeps what went.
`lib/security.ts` (`timingSafeEqual`) stayed; it is used by `/api/revalidate` and both cron routes.

**When the PayFast shop path lands it starts from scratch:** a signed redirect plus an ITN webhook
validated by MD5 signature and a server postback.

Signing creates no portal access or other account: provision-on-sign and `lib/portal/provision.ts`
were removed in web-standalone phase 3 (2026-10-07).
