'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ContactForm } from '@/components/landing/ContactForm';
import { SavingsCalculator } from '@/components/landing/SavingsCalculator';
import { LeadMagnetSignup } from '@/components/landing/LeadMagnetSignup';
import { enabledContactTabs, type ContactTabId } from '@/config/homepage';
import type { Bracket, Service, Tier } from '@/types';

interface ContactSectionProps {
  services: Service[];
  brackets: Bracket[];
  tiers: Tier[];
}

export function ContactSection({ services, brackets, tiers }: ContactSectionProps) {
  const tabs = enabledContactTabs();
  const [active, setActive] = useState<ContactTabId>(tabs[0]?.id ?? 'roi');
  const showTabSwitcher = tabs.length > 1;
  const current = showTabSwitcher ? active : tabs[0]?.id;

  function renderVariant(id: ContactTabId | undefined) {
    if (id === 'guide') return <LeadMagnetSignup />;
    if (id === 'roi')
      return <SavingsCalculator services={services} brackets={brackets} tiers={tiers} />;
    return null;
  }

  return (
    <section id="contact" className="premium-section py-14 lg:py-20">
      <SectionDivider />
      <div className="max-w-7xl mx-auto px-6">
        <ScrollReveal>
          <SectionHeading
            eyebrow="Talk to us"
            title="See what it would cost, then start a conversation"
            subtitle="Get a quick sense of the numbers, or just tell us about your business. A real accountant reads every message."
          />
        </ScrollReveal>

        <div className="mt-12 grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          {/* Left: lead-capture variant(s) */}
          <ScrollReveal>
            <div className="premium-glass rounded-2xl border border-white/10 bg-card/75 p-6 sm:p-8">
              {showTabSwitcher && (
                <div className="mb-6 flex flex-wrap gap-2" role="tablist">
                  {tabs.map((t) => (
                    <Button
                      key={t.id}
                      type="button"
                      size="sm"
                      role="tab"
                      aria-selected={active === t.id}
                      variant={active === t.id ? 'default' : 'ghost'}
                      onClick={() => setActive(t.id)}
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>
              )}
              {renderVariant(current)}
            </div>
          </ScrollReveal>

          {/* Right: contact form */}
          <ScrollReveal delay={0.1}>
            <div className="premium-glass rounded-2xl border border-white/10 bg-card/75 p-6 sm:p-8">
              <h3 className="text-lg font-semibold">Send us a message</h3>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Not ready to price it up? Ask a question and we&apos;ll point you in the right
                direction.
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
