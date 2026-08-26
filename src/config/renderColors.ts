/**
 * Colour values for renderers that do not participate in the site CSS cascade.
 *
 * The dark-theme values mirror the adopted design tokens. OG-only and
 * signature-canvas values preserve their existing pixels unless a governed
 * token explicitly replaces them.
 */
export const RENDER_COLORS = {
  dark: {
    background: '#020618',
    foreground: '#f8fafc',
    mutedForeground: '#90a1b9',
    primary: '#2dd4ff',
  },
  og: {
    mutedForeground: '#94a3b8',
    primarySoft: 'rgba(45, 212, 255, 0.15)',
    primaryBorder: 'rgba(45, 212, 255, 0.3)',
  },
  signatureCanvas: {
    background: '#ffffff',
    ink: '#0f172a',
  },
} as const;
