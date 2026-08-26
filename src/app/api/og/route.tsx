import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { RENDER_COLORS } from '@/config/renderColors';

// No `runtime = 'edge'` here: on OpenNext/Cloudflare the Worker already runs at
// the edge, and declaring the edge runtime makes OpenNext refuse to bundle the
// route into the main worker. The default runtime is what Cloudflare wants.
export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = searchParams.get('page') ?? 'landing';

  const title =
    page === 'pricing'
      ? 'Transparent Pricing | Capucor Business Solutions'
      : 'Outsourced Finance for Growing SMEs';

  const subtitle =
    page === 'pricing'
      ? 'Build your exact subscription with our interactive pricing calculator.'
      : 'Subscription accounting, bookkeeping, and payroll. No hourly billing.';

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

        {/* Logo / brand */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '40px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: RENDER_COLORS.dark.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: RENDER_COLORS.dark.background,
              }}
            />
          </div>
          <span
            style={{
              color: RENDER_COLORS.dark.foreground,
              fontSize: '20px',
              fontWeight: 600,
              letterSpacing: '-0.02em',
            }}
          >
            Capucor Business Solutions
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            color: RENDER_COLORS.dark.foreground,
            fontSize: '56px',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            maxWidth: '900px',
            marginBottom: '24px',
          }}
        >
          {title}
        </div>

        {/* Subtitle */}
        <div
          style={{
            color: RENDER_COLORS.og.mutedForeground,
            fontSize: '24px',
            lineHeight: 1.4,
            maxWidth: '700px',
          }}
        >
          {subtitle}
        </div>

        {/* Bottom tag */}
        <div
          style={{
            position: 'absolute',
            bottom: '60px',
            right: '80px',
            display: 'flex',
            gap: '12px',
          }}
        >
          {['SAICA Aligned', 'Xero Partner'].map((tag) => (
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
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
