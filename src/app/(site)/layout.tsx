import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

// Marketing chrome for the public site — everything served from capucor.com
// (home, services, pricing, privacy, terms, resources). The `(site)` folder is
// a route group: it does not appear in the URL. Fonts, globals.css and the
// default metadata are inherited from the root layout.
//
// /login and /onboarding are NOT here — they belong to Capucor OS on
// capucor.app and live in the `(app)` group with their own slim shell.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
