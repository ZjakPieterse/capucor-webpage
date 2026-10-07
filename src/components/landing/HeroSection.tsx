"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { HeroStory } from "@/components/landing/HeroStory";

// ── Hero Section ──────────────────────────────────────────────────────────────────
// No eyebrow, and no motion inside the headline (Zjak, 2026-10-07). On load the
// hero builds in order: headline, panel, subtext, buttons, trust line.
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
            <motion.h1
              initial={prefersReducedMotion ? false : { opacity: 0, y: 18, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="hero-headline text-[2.6rem] sm:text-6xl lg:text-[4.1rem] font-semibold leading-[1.02] pb-1 mb-6">
              From monthly chaos to{" "}
              <span className="hero-headline-accent">numbers that work for you</span>
            </motion.h1>

            <motion.p
              className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: prefersReducedMotion ? 0 : 0.45,
              }}
            >
              We close your books, run payroll and handle SARS submissions every
              month. You get your time back, and clear action points that turn
              the numbers into your next move.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-3"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: prefersReducedMotion ? 0 : 0.6,
              }}
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
            </motion.div>

            <motion.p
              className="mt-5 text-sm text-muted-foreground/80"
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: prefersReducedMotion ? 0 : 0.75 }}
            >
              Fixed monthly fee <span aria-hidden className="mx-1.5">·</span> No lock-in contracts{" "}
              <span aria-hidden className="mx-1.5">·</span> Start in any month
            </motion.p>
          </div>

          {/* The story: chaos → order → decision */}
          <motion.div
            className="relative"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <HeroStory />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
