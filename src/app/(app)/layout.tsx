import Image from 'next/image';
import { siteConfig } from '@/config/site';

// Slim app shell for the Capucor OS entry points that sit outside /portal and
// /internal — /login (+ /login/callback) and /onboarding.
//
// These used to live in the (site) route group and wore the marketing
// Navbar/Footer. That was wrong once the domains split: both pages are served
// from capucor.app, and every marketing nav link on them would 301 the visitor
// straight back to capucor.com. Route groups don't change the URL, so /login
// and /onboarding are unmoved as far as Supabase's redirect allowlist and any
// existing invite email are concerned.
//
// No auth logic here — /login resolves its own session (and redirects a
// signed-in visitor onward), /onboarding gates itself with requireSession().
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-border bg-card/40">
        <div className="mx-auto flex max-w-5xl items-center px-6 py-3">
          <a
            href={siteConfig.marketingUrl}
            className="flex items-center transition-opacity hover:opacity-80"
          >
            <Image
              src="/brand/logo-dark.png"
              alt="Capucor Business Solutions"
              height={40}
              width={200}
              className="h-8 w-auto"
              style={{ width: 'auto' }}
            />
          </a>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </>
  );
}
