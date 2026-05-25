// Current consent text version + language captured against every lead.
// Bump CONSENT_VERSION whenever the wording on the website's consent
// checkbox or privacy notice changes substantively — this lets us prove,
// per-row, exactly which version of the notice the user agreed to (POPIA).
//
// Add a new language code here when localised consent copy ships.

export const CONSENT_VERSION = 'v1';
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
