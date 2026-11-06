// Version + language of the privacy notice, stamped on every lead, proposal
// and data-request row so we can show, per row, which notice the person saw
// (POPIA s18). Bump CONSENT_VERSION, and PRIVACY_POLICY_UPDATED, whenever the
// /privacy text or the form notice (components/ui/PrivacyNotice.tsx) changes
// substantively.
//   v1: a required "I consent to … contacting me" checkbox (consent_given true).
//   v2 (2026-11-06): a notice line, no consent asked (consent_given stays at
//       its default, false). Replying rests on POPIA s11(1)(b).
//   v3 (2026-11-06): retention periods for unsigned proposals, data requests
//       and email delivery records added to /privacy.
// The e-signature consent on /proposal/<token> is separate and unchanged.
//
// Add a new language code here when localised copy ships.

export const CONSENT_VERSION = 'v3';
// Shown as "Last updated" on /privacy. A fixed date, never new Date().
export const PRIVACY_POLICY_UPDATED = '6 November 2026';
export const CONSENT_LANGUAGE = 'en-ZA';

// POPIA P4: maximum number of days within which we will respond to a verified
// data-subject access / deletion request. Surfaced on /privacy and in the
// confirmation email so users know what to expect.
export const DATA_REQUEST_SLA_DAYS = 30;

// POPIA P3: enquiry data with status='new' is automatically deleted by the
// daily prune cron after this many days. Engaged-client data is governed by
// the engagement letter and falls outside this window.
export const LEAD_RETENTION_DAYS = 365;

// Retention periods decided by Zjak on 2026-11-06 (privacy notice v3), run by
// the same daily prune job (src/lib/retention.ts). POPIA s14: no longer than
// the purpose needs.
// Unsigned proposals (sent, viewed, expired, declined or superseded without a
// signature): deleted this many days after they expired. Follow-up window.
export const UNSIGNED_PROPOSAL_RETENTION_DAYS = 90;
// POPIA access/deletion requests: proof we handled them.
export const DATA_REQUEST_RETENTION_DAYS = 730;
// Email delivery records (finished sends only; signed-proposal emails stay with
// the signed proposal): proof a proposal or confirmation was delivered.
export const EMAIL_DELIVERY_RETENTION_DAYS = 365;

// How long a data-request magic-link token remains valid after issue.
export const DATA_REQUEST_TOKEN_TTL_HOURS = 24;
