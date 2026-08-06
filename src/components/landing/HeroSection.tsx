"use client";

import { use3DTilt } from "@/hooks/use3DTilt";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  TrendingDown,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
// ── Date helpers ──────────────────────────────────────────────────────────────────
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MONTH_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type VatStatus = "green" | "amber" | "red";

interface DashboardDates {
  vatDateStr: string;
  vatDays: number;
  vatStatus: VatStatus;
  closeMonth: string;
}

function computeDashboardDates(): DashboardDates {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const monthOffset = today.getDate() > 25 ? 1 : 0;
  const vatDue = new Date(now.getFullYear(), now.getMonth() + monthOffset, 25);
  const msPerDay = 1000 * 60 * 60 * 24;
  const vatDays = Math.round((vatDue.getTime() - today.getTime()) / msPerDay);
  const vatDateStr = `25 ${MONTH_SHORT[vatDue.getMonth()]} ${vatDue.getFullYear()}`;
  const vatStatus: VatStatus =
    vatDays > 15 ? "green" : vatDays > 7 ? "amber" : "red";

  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const closeMonth = MONTH_FULL[prev.getMonth()];

  return { vatDateStr, vatDays, vatStatus, closeMonth };
}

const VAT_STATUS_STYLES: Record<VatStatus, { bg: string; color: string }> = {
  green: { bg: "var(--success-soft)", color: "var(--success)" },
  amber: { bg: "rgba(234,179,8,.15)", color: "#eab308" },
  red: { bg: "rgba(239,68,68,.15)", color: "#ef4444" },
};

// ── Finance Command Centre ────────────────────────────────────────────────────────

function FinanceCommandCentre() {
  const dates = computeDashboardDates();
  const vatStyle = VAT_STATUS_STYLES[dates.vatStatus];
  const prefersReducedMotion = useReducedMotion();
  const { ref: tiltRef, rotateX, rotateY, lift, scale, onMouseMove, onMouseLeave } =
    use3DTilt<HTMLDivElement>();

  return (
    <motion.div
      ref={tiltRef}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        rotateX,
        rotateY,
        y: lift,
        scale,
        transformPerspective: 1200,
        transformStyle: "preserve-3d",
      }}
      className="fcc-container tilt-card premium-card relative rounded-2xl border-[0.5px] border-white/10 bg-card/80 shadow-2xl p-4 sm:p-5 overflow-hidden min-h-[340px] sm:min-h-[380px] lg:min-h-[420px] transition-[border-color,box-shadow,background-color] duration-500">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-16 z-0 rounded-full bg-primary/10 blur-3xl"
      />

      {/* Header */}
      <div className="fcc-header flex items-center justify-between mb-4 relative z-20">
        <div>
          <div className="text-sm font-bold tracking-tight">
            Finance Command Centre
          </div>
          <div
            className="text-xs mt-0.5"
            style={{ color: "rgba(255,255,255,.55)" }}
            suppressHydrationWarning
          >
            {dates.closeMonth} close complete. Three items flagged for review.
          </div>
        </div>
        {/* ⚠️ This panel is a DESIGN MOCKUP with hardcoded figures, not a live
            dashboard, and it must never present itself as one. It used to carry
            a pulsing cyan "Live" badge next to invented numbers (Cash Runway
            4.2 months, Debtor Days 32), on the homepage of an accounting firm
            asking visitors to sign a debit-order mandate. Capucor does not yet
            surface any of these figures to a client — the portal's finance page
            reads "Connect Xero (coming soon)". Keep the label honest: if this
            ever does show real data, change the copy in the same commit that
            makes it true. */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: "rgba(255,255,255,.06)",
            color: "rgba(255,255,255,.55)",
          }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "rgba(255,255,255,.35)" }}
          />
          Example
        </div>
      </div>

      {/* Tile grid */}
      <div className="fcc-grid grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5 relative z-20">
        {/* Cash Runway */}
        <div className="fcc-tile premium-glass rounded-xl border-[0.5px] border-white/10 bg-background/40 p-3.5">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Cash Runway
          </div>
          <div className="gradient-stat font-mono font-bold text-xl leading-none">
            4.2
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">months</div>
          <div
            className="mt-2.5 h-1.5 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,.08)" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{
                background:
                  "linear-gradient(to right, var(--brand-cyan), var(--success))",
              }}
              initial={prefersReducedMotion ? false : { width: 0 }}
              animate={{ width: "35%" }}
              transition={{ delay: 1.4, duration: 0.9, ease: "easeOut" }}
            />
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            of 12 months
          </div>
          <div
            className="text-[10px] mt-1 font-medium"
            style={{ color: "#eab308" }}
          >
            Watch: below 6-month target
          </div>
        </div>

        {/* Debtor Days */}
        <div className="fcc-tile premium-glass rounded-xl border-[0.5px] border-white/10 bg-background/40 p-3.5">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Debtor Days
          </div>
          <div className="font-mono font-bold text-xl leading-none">32</div>
          <div className="text-xs text-muted-foreground mt-0.5">days</div>
          <div className="flex items-center gap-1 mt-2">
            <TrendingDown
              className="h-3.5 w-3.5 shrink-0 text-success"
            />
            <span className="text-[11px] font-medium text-success">
              −4 vs last month
            </span>
          </div>
        </div>

        {/* VAT Due Date */}
        <div className="fcc-tile premium-glass rounded-xl border-[0.5px] border-white/10 bg-background/40 p-3.5">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            VAT Due
          </div>
          <div
            className="font-mono font-bold text-sm leading-tight"
            suppressHydrationWarning
          >
            {dates.vatDateStr}
          </div>
          <div className="mt-2">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
              style={{ background: vatStyle.bg, color: vatStyle.color }}
              suppressHydrationWarning
            >
              <AlertCircle className="h-3 w-3" />
              {dates.vatDays} days
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1.5">
            Prepared before deadline
          </div>
        </div>

        {/* Monthly Close */}
        <div className="fcc-tile premium-glass rounded-xl border-[0.5px] border-white/10 bg-background/40 p-3.5">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Monthly Close
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2
              className="h-4 w-4 shrink-0 text-success"
            />
            <span className="text-xs font-semibold" suppressHydrationWarning>
              {dates.closeMonth}: reviewed
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1.5">
            Senior accountant sign-off
          </div>
        </div>

        {/* Payroll */}
        <div className="fcc-tile premium-glass rounded-xl border-[0.5px] border-white/10 bg-background/40 p-3.5">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Payroll
          </div>
          <div className="flex items-center gap-1.5">
            <motion.div
              className="w-2 h-2 rounded-full shrink-0 bg-success"
              animate={prefersReducedMotion ? undefined : { opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-xs font-semibold text-success">
              EMP201 submitted
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1.5">
            Payslips delivered
          </div>
        </div>

        {/* Management Report */}
        <div className="fcc-tile premium-glass rounded-xl border-[0.5px] border-white/10 bg-background/40 p-3.5">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Management Report
          </div>
          <div className="flex items-center gap-1.5">
            <Clock
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: "#22d3ee" }}
            />
            <span
              className="text-[11px] font-semibold"
              style={{ color: "#22d3ee" }}
            >
              Ready for review
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1.5">
            3 insights flagged
          </div>
        </div>

        {/* SARS / CIPC Compliance — Standardized look */}
        <div className="fcc-tile premium-glass col-span-2 sm:col-span-3 rounded-xl border-[0.5px] border-white/10 bg-background/40 p-3.5">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2.5">
            SARS / CIPC Compliance
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {["Provisional Tax", "EMP201", "CIPC Annual Return"].map((item) => (
              <div key={item} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                <span className="text-xs font-medium text-foreground/80">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Says in words what the "Example" badge says in a glance. Two labels
          because the badge is small and this is the claim that has to be
          unambiguous. */}
      <p className="relative z-20 mt-3 text-[10px] leading-relaxed text-muted-foreground">
        Illustrative example. The figures shown are not client data.
      </p>
    </motion.div>
  );
}

// ── Hero Section ──────────────────────────────────────────────────────────────────
export function HeroSection() {
  const headline =
    "Zero tax nightmares. 20+ hours saved. Let’s grow your empire.";
  // Cyan brand-gradient highlight on the two value phrases: "20+ hours" (indices 3-4)
  // and "your empire" (indices 8-9).
  const HIGHLIGHT_INDICES = new Set([3, 4, 8, 9]);
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      className="premium-section relative overflow-hidden py-20 pb-28 sm:py-28 sm:pb-36 lg:py-36 lg:pb-48"
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
            <motion.p
              className="text-sm font-medium uppercase tracking-widest mb-4 text-primary"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              Outsourced finance team for your growing business
            </motion.p>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] mb-6 flex flex-wrap gap-[0.25em]">
              {headline.split(" ").map((word, i) => (
                <motion.span
                  key={i}
                  className={
                    HIGHLIGHT_INDICES.has(i) ? "gradient-text-brand" : undefined
                  }
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    delay: prefersReducedMotion ? 0 : 0.1 + i * 0.08,
                    ease: "easeOut",
                  }}
                >
                  {word}
                </motion.span>
              ))}
            </h1>

            <motion.p
              className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: prefersReducedMotion ? 0 : 0.5,
              }}
            >
              Monthly accounting, payroll, tax, and reporting handled by real
              accountants. Clean numbers, clear deadlines, and practical advice
              built into one fixed monthly subscription.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-3"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: prefersReducedMotion ? 0 : 0.7,
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

          </div>

          {/* Dashboard */}
          <div className="relative">
            <FinanceCommandCentre />
          </div>
        </div>
      </div>
    </section>
  );
}
