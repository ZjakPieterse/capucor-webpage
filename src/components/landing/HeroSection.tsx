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
  Info,
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
  amber: { bg: "var(--warning-soft)", color: "var(--warning)" },
  red: { bg: "var(--destructive-soft)", color: "var(--destructive)" },
};

// ── Your month at a glance (hero example panel) ──────────────────────────────────
// An illustration of one month on the rhythm, not a product screen. Every figure
// is hard-coded by decision (website-v2, Zjak, 2026-10-05) and the panel says so
// twice: the static "Example" badge and the footnote. No pulsing or "live" cues,
// and no portal framing, because capucor.app is being sunset.

type RhythmState = "done" | "due";

interface RhythmItem {
  label: string;
  detail: string;
  state: RhythmState;
}

function MonthAtAGlance() {
  const dates = computeDashboardDates();
  const vatStyle = VAT_STATUS_STYLES[dates.vatStatus];
  const prefersReducedMotion = useReducedMotion();
  const { ref: tiltRef, rotateX, rotateY, lift, scale, onMouseMove, onMouseLeave } =
    use3DTilt<HTMLDivElement>();

  const rhythm: RhythmItem[] = [
    { label: "Books closed", detail: `${dates.closeMonth} reconciled`, state: "done" },
    { label: "Payroll", detail: "Payslips out, EMP201 submitted", state: "done" },
    { label: "Report", detail: "Reviewed before it reaches you", state: "done" },
    { label: "VAT201", detail: `Due ${dates.vatDateStr}`, state: "due" },
  ];

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
      className="fcc-container tilt-card premium-card relative rounded-2xl border-[0.5px] border-white/10 bg-card/80 shadow-2xl p-4 sm:p-5 overflow-hidden transition-[border-color,box-shadow,background-color] duration-500"
      role="figure"
      aria-label="Example of a month on the Capucor rhythm. Figures are for illustration."
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-16 z-0 rounded-full bg-primary/10 blur-3xl"
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4 relative z-20">
        <div>
          <div className="text-sm font-bold tracking-tight">
            Your month at a glance
          </div>
          <div
            className="text-xs mt-0.5"
            style={{ color: "rgba(255,255,255,.55)" }}
            suppressHydrationWarning
          >
            {dates.closeMonth} closed. Three points to discuss at your review.
          </div>
        </div>
        <div className="shrink-0 px-2.5 py-1 rounded-md border border-white/15 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Example
        </div>
      </div>

      {/* This month's rhythm */}
      <div className="relative z-20">
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
          This month
        </div>
        <ol className="fcc-grid grid gap-1.5">
          {rhythm.map((item) => (
            <li
              key={item.label}
              className="fcc-tile premium-glass flex items-center gap-3 rounded-xl border-[0.5px] border-white/10 bg-background/40 px-3.5 py-2.5"
            >
              {item.state === "done" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              ) : (
                <Clock className="h-4 w-4 shrink-0" style={{ color: "var(--brand-cyan)" }} />
              )}
              <span className="text-xs font-semibold whitespace-nowrap">{item.label}</span>
              <span
                className="ml-auto text-right text-[11px] text-muted-foreground"
                suppressHydrationWarning
              >
                {item.detail}
              </span>
              {item.state === "due" && (
                <span
                  className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ background: vatStyle.bg, color: vatStyle.color }}
                  suppressHydrationWarning
                >
                  <AlertCircle className="h-3 w-3" />
                  {dates.vatDays} days
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>

      {/* Three points to discuss */}
      <div className="relative z-20 mt-4">
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
          To discuss at your review
        </div>
        <div className="fcc-grid grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2">
          {/* Cash runway */}
          <div className="fcc-tile premium-glass rounded-xl border-[0.5px] border-white/10 bg-background/40 p-3.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Cash runway
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="gradient-stat font-mono font-bold text-xl leading-none">4.2</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">months</span>
            </div>
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
                transition={{ delay: 1.4, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <div className="text-[10px] mt-1.5 font-medium" style={{ color: "var(--warning)" }}>
              Below the 6-month target
            </div>
          </div>

          {/* Debtor days */}
          <div className="fcc-tile premium-glass rounded-xl border-[0.5px] border-white/10 bg-background/40 p-3.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Debtor days
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono font-bold text-xl leading-none">32</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">days</span>
            </div>
            <div className="flex items-center gap-1 mt-2.5">
              <TrendingDown className="h-3.5 w-3.5 shrink-0 text-success" />
              <span className="text-[11px] font-medium text-success">
                −4 vs last month
              </span>
            </div>
          </div>

          {/* Provisional tax */}
          <div className="fcc-tile premium-glass col-span-2 sm:col-span-1 rounded-xl border-[0.5px] border-white/10 bg-background/40 p-3.5">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Provisional tax
            </div>
            <div className="text-xs font-semibold leading-snug">IRP6 estimate</div>
            <div className="text-[11px] text-muted-foreground mt-1 leading-snug">
              Confirm the profit forecast before it&apos;s filed
            </div>
          </div>
        </div>
      </div>

      {/* Footnote */}
      <div className="relative z-20 mt-4 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Info className="h-3 w-3 shrink-0" />
        Example figures for illustration.
      </div>
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
            <MonthAtAGlance />
          </div>
        </div>
      </div>
    </section>
  );
}
