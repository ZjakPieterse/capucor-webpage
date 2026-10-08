"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FitCallNote } from "@/components/ui/FitCallNote";
import { siteConfig } from "@/config/site";
import { HeroStory } from "@/components/landing/HeroStory";

// ── Hero Section ──────────────────────────────────────────────────────────────────
// No eyebrow, and no motion inside the headline (Zjak, 2026-10-07). On load the
// hero builds in order: headline, panel, subtext, buttons, trust line.
//
// ⚠️ The entrance is CSS (`.hero-enter*` in globals.css), not `motion`
// (technical review T01, 2026-10-08). With `motion`, the server HTML shipped
// every line at `opacity:0` and nothing painted until ~280 KB of JS had
// hydrated: 91 % of a 5.5 s mobile LCP. The CSS keyframes start at first paint,
// need no JS, and are skipped under prefers-reduced-motion. Do not move the
// copy back into `motion.*` with an `initial` state. `motion` stays only on the
// decorative, aria-hidden glow orbs.
export function HeroSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      className="premium-section relative overflow-hidden py-20 pb-28 sm:py-28 sm:pb-36 lg:py-32 lg:pb-40"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <motion.div
          className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-primary/8 blur-3xl"
          animate={
            prefersReducedMotion
              ? undefined
              : { scale: [1, 1.08, 1], opacity: [0.9, 1, 0.9] }
          }
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/3 right-[8%] h-[260px] w-[260px] rounded-full blur-3xl"
          style={{
            background:
              "color-mix(in oklch, var(--brand-cyan) 18%, transparent)",
          }}
          animate={
            prefersReducedMotion
              ? undefined
              : { scale: [1, 1.12, 1], opacity: [0.6, 0.85, 0.6] }
          }
          transition={{
            duration: 11,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1.5,
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-14 h-full flex flex-col justify-center">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* Copy */}
          <div className="hero-copy-container">
            <h1 className="hero-enter hero-enter-headline hero-headline text-[2.6rem] sm:text-6xl lg:text-[4.1rem] font-semibold leading-[1.02] pb-1 mb-6">
              From monthly chaos to{" "}
              <span className="hero-headline-accent">numbers that work for you</span>
            </h1>

            <p
              className="hero-enter text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg"
              style={{ animationDelay: "0.45s" }}
            >
              We close your books, run payroll and handle SARS submissions every
              month. You get your time back, and clear action points that turn
              the numbers into your next move.
            </p>

            <div
              className="hero-enter flex flex-col sm:flex-row gap-3"
              style={{ animationDelay: "0.6s" }}
            >
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

            <div className="hero-enter hero-enter-fade" style={{ animationDelay: "0.75s" }}>
              <FitCallNote className="mt-3" />
              <p className="mt-4 text-sm text-muted-foreground/80">
                Fixed monthly fee <span aria-hidden className="mx-1.5">·</span> No lock-in contracts{" "}
                <span aria-hidden className="mx-1.5">·</span> Start in any month
              </p>
            </div>
          </div>

          {/* The story: chaos → order → decision */}
          <div className="hero-enter hero-enter-panel relative" style={{ animationDelay: "0.3s" }}>
            <HeroStory />
          </div>
        </div>
      </div>
    </section>
  );
}
