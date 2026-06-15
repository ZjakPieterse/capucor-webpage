import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ContactForm } from '@/components/landing/ContactForm';
import { LeadMagnetSignup } from '@/components/landing/LeadMagnetSignup';

export function ContactSection() {
  return (
    <section id="contact" className="premium-section py-14 lg:py-20">
      <SectionDivider />
      <div className="max-w-7xl mx-auto px-6">
        <ScrollReveal>
          <SectionHeading
            eyebrow="Talk to us"
            title="Start a conversation"
            subtitle="Grab the free compliance calendar, or tell us about your business. A real accountant reads every message."
          />
        </ScrollReveal>

        <div className="mt-12 grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          {/* Left: free-guide lead magnet */}
          <ScrollReveal>
            <div className="premium-glass rounded-2xl border border-white/10 bg-card/75 p-6 sm:p-8">
              <LeadMagnetSignup />
            </div>
          </ScrollReveal>

          {/* Right: contact form */}
          <ScrollReveal delay={0.1}>
            <div className="premium-glass rounded-2xl border border-white/10 bg-card/75 p-6 sm:p-8">
              <h3 className="text-lg font-semibold">Send us a message</h3>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Ask a question and we&apos;ll point you in the right direction.
              </p>
              <div className="mt-5">
                <ContactForm />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
