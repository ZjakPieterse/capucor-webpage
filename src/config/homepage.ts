// Homepage contact section — left-column lead-capture variants.
//
// The section runs two capture variants side by side so we can see which one
// pulls more enquiries, then keep the stronger one. Each variant posts to
// /api/leads with its own `source` tag ('roi' / 'lead_magnet'), so the feedback
// signal is simply the lead count per source in Supabase — no A/B tooling.
//
// Flip `enabled` to light a tab up or dark it down:
//   - When one tab is enabled, the left column renders it without tab chrome.
//   - When both are enabled, the column shows a tab switcher.
//
// The lead-magnet ("guide") tab stays off until a downloadable asset exists.
// See capucor-web/AGENTS.md → Pending Content before switching it on.

export type ContactTabId = 'roi' | 'guide';

export interface ContactTab {
  id: ContactTabId;
  /** Tab switcher label (only shown when more than one tab is enabled). */
  label: string;
  enabled: boolean;
}

export const CONTACT_LEFT_TABS: ContactTab[] = [
  { id: 'roi', label: 'Estimate your costs', enabled: true },
  { id: 'guide', label: 'Get the free guide', enabled: false },
];

export const enabledContactTabs = (): ContactTab[] =>
  CONTACT_LEFT_TABS.filter((t) => t.enabled);
