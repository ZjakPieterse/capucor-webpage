"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  Unplug,
  Clock,
  CheckCircle2,
  CalendarCheck,
  Link2,
  Users,
  Zap,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { motion, useReducedMotion } from "motion/react";

const PROBLEMS = [
  {
    icon: Unplug,
    title: "You never hear from your accountant",
    body: "It's the 15th. The bank wants management accounts for a facility review. You've emailed your accountant twice this week. The last thing you heard from them was the year-end invoice.",
    solution: {
      icon: CheckCircle2,
      title: "We reach out to you every month",
      body: "Each month is closed and reconciled before the next one gets busy. When the bank asks for numbers, they're already there, and you didn't have to chase anyone for them.",
    },
  },
  {
    icon: AlertCircle,
    title: "An unexpected letter from SARS comes in",
    body: "A penalty notice arrives for a missed EMP201. You thought it was filed. It wasn't. Now you're paying for a mistake that should never have reached your desk.",
    solution: {
      icon: CalendarCheck,
      title: "Deadlines that don’t depend on memory",
      body: "EMP201, VAT201, provisional tax and CIPC sit on one calendar with review dates. Each return is prepared, checked and filed on its own cycle, and you can see that it's done.",
    },
  },
  {
    icon: Users,
    title: "More staff, more submissions",
    body: "You've just hired your twelfth person and registered for VAT. Payroll lives in a spreadsheet, the EMP201 is due on the 7th, and the UIF and COIDA paperwork keeps piling up.",
    solution: {
      icon: Link2,
      title: "Payroll on the same rhythm as your books",
      body: "Payslips, EMP201, UIF and COIDA run on their cycles next to your VAT201. New hires and the VAT registration are set up properly from the start, and EMP501 is ready when it's due.",
    },
  },
  {
    icon: Clock,
    title: "Too much owner dependence",
    body: "Your evenings and weekends are consumed by paperwork, missing receipts, and basic finance questions. The work never stops. But your growth does.",
    solution: {
      icon: Zap,
      title: "The decisions become priority",
      body: "Each month, you send us your data, and we handle the finances and monthly close. Then, we review the numbers together to map out your next strategic moves.",
    },
  },
];

type Problem = (typeof PROBLEMS)[number];

const FACE_STYLE = {
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
} as const;

/**
 * One problem card that turns over like a real card: the problem is printed on
 * the front, the Capucor answer on the back. Both faces share one grid cell, so
 * the card is as tall as its longer side and never jumps in height mid-flip.
 */
function FlipCard({ item }: { item: Problem }) {
  const [isResolved, setIsResolved] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const frontButton = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);

  // Keyboard users land on the button of the side that just turned up.
  const flip = () => {
    const next = !isResolved;
    setIsResolved(next);
    requestAnimationFrame(() =>
      (next ? backButton : frontButton).current?.focus({ preventScroll: true }),
    );
  };

  return (
    <motion.div
      className="grid h-full"
      style={{ transformStyle: "preserve-3d", transformPerspective: 1200 }}
      initial={false}
      animate={{ rotateY: isResolved ? 180 : 0 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { duration: 0.6, ease: [0.45, 0, 0.55, 1] }
      }
    >
      {/* Front: the problem */}
      <div
        className="[grid-area:1/1]"
        style={FACE_STYLE}
        aria-hidden={isResolved}
        inert={isResolved}
      >
        <div
          data-state="problem"
          className="problem-card premium-card h-full rounded-2xl border border-destructive/30 bg-destructive/5 p-6 flex flex-col"
        >
          <div className="flex-1">
            <div className="mb-4 flex items-center gap-3">
              <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-destructive/15 bg-destructive/10">
                <item.icon className="h-5 w-5 text-destructive animate-pulse" />
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-destructive/80">
                The Problem
              </div>
            </div>
            <h3 className="text-base font-semibold mb-2">{item.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {item.body}
            </p>
          </div>
          <button
            ref={frontButton}
            type="button"
            onClick={flip}
            data-state="problem"
            className="flip-cue mt-5 self-start inline-flex h-10 items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 text-sm font-semibold text-primary"
          >
            We can fix this
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Back: the solution, pre-turned so it reads correctly once flipped */}
      <div
        className="[grid-area:1/1]"
        style={{ ...FACE_STYLE, transform: "rotateY(180deg)" }}
        aria-hidden={!isResolved}
        inert={!isResolved}
      >
        <div
          data-state="solution"
          className="problem-card premium-card h-full rounded-2xl border border-primary/30 bg-card shadow-[0_0_20px_rgba(45,212,255,0.05)] p-6 flex flex-col"
        >
          <div className="flex-1">
            <div className="mb-4 flex items-center gap-3">
              <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                <item.solution.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                Capucor Solution
              </div>
            </div>
            <h3 className="text-base font-semibold mb-2">
              {item.solution.title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {item.solution.body}
            </p>
          </div>
          <button
            ref={backButton}
            type="button"
            onClick={flip}
            data-state="solution"
            className="flip-cue mt-5 self-start inline-flex h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-sm font-semibold text-muted-foreground"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Back to the problem
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function ProblemCards() {
  return (
    <section className="premium-section py-14 lg:py-20">
      <SectionDivider />
      <div className="max-w-7xl mx-auto px-6">
        <ScrollReveal>
          <SectionHeading
            title="Your business has outgrown year-end accounting"
            subtitle="You hear from your accountant once a year, with a huge bill. Meanwhile EMP201, VAT201 and provisional tax keep coming, and you're the one chasing."
          />
        </ScrollReveal>

        {/* Each card flips on its own, so the reader turns problems into answers one at a time. */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 min-h-[280px] mt-12">
          {PROBLEMS.map((item, i) => (
            <ScrollReveal key={item.title} delay={i * 0.08} className="h-full">
              <FlipCard item={item} />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
