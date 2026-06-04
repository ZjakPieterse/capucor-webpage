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
// The "guide" tab delivers the printable /resources/compliance-calendar page
// (LeadMagnetSignup). Dark it down again if the resource is taken offline.

export type ContactTabId = 'roi' | 'guide';

export interface ContactTab {
  id: ContactTabId;
  /** Tab switcher label (only shown when more than one tab is enabled). */
  label: string;
  enabled: boolean;
}

export const CONTACT_LEFT_TABS: ContactTab[] = [
  { id: 'roi', label: 'Estimate your costs', enabled: true },
  { id: 'guide', label: 'Get the free guide', enabled: true },
];

export const enabledContactTabs = (): ContactTab[] =>
  CONTACT_LEFT_TABS.filter((t) => t.enabled);
