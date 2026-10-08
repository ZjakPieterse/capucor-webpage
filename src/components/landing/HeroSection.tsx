"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { HeroStory } from "@/components/landing/HeroStory";

// ── Hero Section ──────────────────────────────────────────────────────────────────
// No eyebrow, and no motion inside the headline (Zjak, 2026-10-07).
//
// ⚠️ The copy has no entrance at all (hero-smooth-load, 2026-10-08): headline,
// subtext, buttons and trust line are final in the server HTML, so the first
// frame is settled and nothing waits on JS. Only the story panel eases in
// (`.hero-enter-panel`, transform and opacity). History: T01 moved the copy
// off `motion` (its server HTML shipped at opacity 0 until ~280 KB of JS had
// hydrated); the CSS build-in that replaced it still blurred the headline in,
// and a `filter` animation stalls behind hydration, so the headline painted
// last. Do not give the copy an `opacity: 0` or `filter` starting frame again.
//
// The glow orbs are CSS (`.hero-orb-*`): compositor-only, paused while the hero
// is off-screen, still on phones.
export function HeroSection() {
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) el.removeAttribute("data-hero-paused");
      else el.setAttribute("data-hero-paused", "");
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="premium-section relative overflow-hidden py-20 pb-28 sm:py-28 sm:pb-36 lg:py-32 lg:pb-40"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="hero-orb hero-orb-a absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-primary/8 blur-3xl" />
        <div
          className="hero-orb hero-orb-b absolute top-1/3 right-[8%] h-[260px] w-[260px] rounded-full blur-3xl"
          style={{
            background:
              "color-mix(in oklch, var(--brand-cyan) 18%, transparent)",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-14 h-full flex flex-col justify-center">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* Copy */}
          <div className="hero-copy-container">
            <h1 className="hero-headline text-[2.6rem] sm:text-6xl lg:text-[4.1rem] font-semibold leading-[1.02] pb-1 mb-6">
              From monthly chaos to{" "}
              <span className="hero-headline-accent">numbers that work for you</span>
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
              We close your books, run payroll and handle SARS submissions every
              month. You get your time back, and clear action points that turn
              the numbers into your next move.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                nativeButton={false}
                render={<Link href="/pricing" />}
                size="lg"
                className="gradient-cta gap-2 w-full sm:w-auto"
              >
                <span className="relative z-[2] inline-flex items-center gap-2">
                  Build your subscription <ArrowRight className="h-4 w-4" />
                </span>
              </Button>
              <Button
                nativeButton={false}
                render={
                  <a
                    href={siteConfig.links.booking}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
                variant="outline"
                size="lg"
                className="gap-2 w-full sm:w-auto"
              >
                <Calendar className="h-4 w-4" /> Book a fit call
              </Button>
            </div>

            <p className="mt-4 text-sm text-muted-foreground/80">
              Fixed monthly fee <span aria-hidden className="mx-1.5">·</span> No lock-in contracts{" "}
              <span aria-hidden className="mx-1.5">·</span> Start in any month
            </p>
          </div>

          {/* The story: chaos → order → decision */}
          <div className="hero-enter-panel relative">
            <HeroStory />
          </div>
        </div>
      </div>
    </section>
  );
}
