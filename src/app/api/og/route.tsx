import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { RENDER_COLORS } from '@/config/renderColors';
import { CAPUCOR_LOGO_ON_DARK } from '@/lib/og/capucorLogoOnDark';

// No `runtime = 'edge'` here: on OpenNext/Cloudflare the Worker already runs at
// the edge, and declaring the edge runtime makes OpenNext refuse to bundle the
// route into the main worker. The default runtime is what Cloudflare wants.
export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = searchParams.get('page') ?? 'landing';

  // Copy re-uses approved site lines only (full-site audit, 2026-10-13): the
  // hero headline and subtext, the /pricing heading and intro, and the hero
  // trust line. The retired tagline claimed no hourly fees, which contradicted
  // the engagement terms (older catch-up is billed hourly).
  const title =
    page === 'pricing' ? 'Build your subscription' : 'From monthly chaos to numbers that work for you';

  const subtitle =
    page === 'pricing'
      ? 'A few quick questions, then your fixed monthly fee. No sign-up needed.'
      : 'We close your books, run payroll and handle SARS submissions every month.';

  const trustLine = 'Fixed monthly fee · No lock-in contracts · Start in any month';

  // The credentials shown in the site footer, worded the same.
  const credentials = ['Xero Gold Partner', 'SAICA Member'];

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          background: RENDER_COLORS.dark.background,
          padding: '80px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Accent glow */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            right: '-100px',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${RENDER_COLORS.dark.primary} 0%, transparent 70%)`,
            opacity: 0.15,
          }}
        />

        {/* Logo: the real on-dark master, inlined (no network fetch) */}
        <div style={{ display: 'flex', marginBottom: '48px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders a plain <img> */}
          <img
            src={CAPUCOR_LOGO_ON_DARK.src}
            width={CAPUCOR_LOGO_ON_DARK.width / 2}
            height={CAPUCOR_LOGO_ON_DARK.height / 2}
            alt="Capucor Business Solutions"
          />
        </div>

        {/* Headline */}
        <div
          style={{
            color: RENDER_COLORS.dark.foreground,
            fontSize: '60px',
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: '-0.03em',
            maxWidth: '980px',
            marginBottom: '24px',
          }}
        >
          {title}
        </div>

        {/* Subtitle */}
        <div
          style={{
            color: RENDER_COLORS.og.mutedForeground,
            fontSize: '26px',
            lineHeight: 1.4,
            maxWidth: '900px',
          }}
        >
          {subtitle}
        </div>

        {/* Bottom row: the hero trust line, then the footer credentials */}
        <div
          style={{
            position: 'absolute',
            bottom: '60px',
            left: '80px',
            right: '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', color: RENDER_COLORS.og.mutedForeground, fontSize: '18px' }}>
            {trustLine}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {credentials.map((tag) => (
              <div
                key={tag}
                style={{
                  background: RENDER_COLORS.og.primarySoft,
                  border: `1px solid ${RENDER_COLORS.og.primaryBorder}`,
                  borderRadius: '8px',
                  padding: '6px 14px',
                  color: RENDER_COLORS.dark.primary,
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
