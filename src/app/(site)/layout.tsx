import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ScrollToTopOnRouteChange } from '@/components/layout/ScrollToTopOnRouteChange';

// Marketing chrome for the public site — everything served from capucor.com
// (home, services, pricing, privacy, terms, resources). The `(site)` folder is
// a route group: it does not appear in the URL. Fonts, globals.css and the
// default metadata are inherited from the root layout.
//
// /login, /portal, /internal and /onboarding are not served here at all: they
// redirect to capucor.app (APP_PATHS in next.config.ts) until os-sunset.
//
// The skip link is the first tab stop on every page, so keyboard and
// screen-reader visitors can bypass the navbar (WCAG 2.4.1). `tabIndex={-1}`
// on <main> lets the jump move focus there, not only scroll.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main-content" className="skip-link no-print">
        Skip to content
      </a>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <ScrollToTopOnRouteChange />
      <Footer />
    </>
  );
}
