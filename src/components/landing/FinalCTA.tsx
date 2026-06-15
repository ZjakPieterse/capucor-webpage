"use client";

import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";
import { siteConfig } from "@/config/site";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { Button } from "@/components/ui/button";

export function FinalCTA() {
  return (
    <section className="premium-section relative overflow-hidden py-20 sm:py-24 lg:py-28">
      <SectionDivider />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div
          className="absolute left-1/2 top-1/2 h-[440px] w-[640px] max-w-[140%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in oklch, var(--primary) 18%, transparent), transparent 70%)",
          }}
        />
      </div>

      <div className="max-w-3xl mx-auto px-5 sm:px-6 text-center">
        <ScrollReveal>
          <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight mb-4 leading-[1.1]">
            Ready to make finance work better?
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
            Build your subscription in a few minutes, or book a short fit call
            and we&apos;ll help you choose the right level of monthly support.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
            <Button
              nativeButton={false}
              render={<Link href="/pricing" />}
              size="lg"
              className="gradient-cta gradient-border-cta gap-2 w-full sm:w-auto"
            >
              <span className="relative z-[2] inline-flex items-center gap-2">
                Build your subscription
                <ArrowRight className="h-4 w-4" />
              </span>
            </Button>

            <a
              href={siteConfig.links.booking}
              target="_blank"
              rel="noopener noreferrer"
              className="premium-button inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-input bg-input/30 backdrop-blur-md px-6 text-sm font-semibold hover:bg-input/50 transition-all"
            >
              <Calendar className="h-4 w-4" />
              Book a fit call
            </a>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
