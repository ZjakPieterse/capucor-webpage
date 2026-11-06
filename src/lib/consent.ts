// Version + language of the privacy notice, stamped on every lead, proposal
// and data-request row so we can show, per row, which notice the person saw
// (POPIA s18). Bump CONSENT_VERSION, and PRIVACY_POLICY_UPDATED, whenever the
// /privacy text or the form notice (components/ui/PrivacyNotice.tsx) changes
// substantively.
//   v1: a required "I consent to … contacting me" checkbox (consent_given true).
//   v2 (2026-11-06): a notice line, no consent asked (consent_given stays at
//       its default, false). Replying rests on POPIA s11(1)(b).
// The e-signature consent on /proposal/<token> is separate and unchanged.
//
// Add a new language code here when localised copy ships.

export const CONSENT_VERSION = 'v2';
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

// How long a data-request magic-link token remains valid after issue.
export const DATA_REQUEST_TOKEN_TTL_HOURS = 24;
