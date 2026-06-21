import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

// Marketing chrome for the public site. Wraps the home page and every public
// route (services, pricing, privacy, terms, resources, login, onboarding). The
// `(site)` folder is a route group — it does not appear in the URL. Fonts,
// globals.css and the default metadata are inherited from the root layout.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
