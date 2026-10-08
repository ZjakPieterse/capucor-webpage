"use client";

import { useState } from "react";
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
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const PROBLEMS = [
  {
    icon: Unplug,
    title: "Your accountant has gone quiet",
    body: "It's the 15th. The bank wants management accounts for a facility review. You've emailed your accountant twice this week. The last thing you heard from them was the year-end invoice.",
    solution: {
      icon: CheckCircle2,
      title: "You hear from us on a schedule.",
      body: "Each month is closed and reconciled before the next one gets busy. When the bank asks for numbers, they're already there, and you didn't have to chase anyone for them.",
    },
  },
  {
    icon: AlertCircle,
    title: "A letter from SARS",
    body: "A penalty notice arrives for a missed EMP201. You thought it was filed. It wasn't. Now you're paying for a mistake that should never have reached your desk.",
    solution: {
      icon: CalendarCheck,
      title: "Deadlines that don’t depend on memory.",
      body: "EMP201, VAT201, provisional tax and CIPC sit on one calendar with review dates. Each return is prepared, checked and filed on its own cycle, and you can see that it's done.",
    },
  },
  {
    icon: Users,
    title: "More staff, more submissions",
    body: "You've just hired your twelfth person and registered for VAT. Payroll lives in a spreadsheet, the EMP201 is due on the 7th, and the UIF and COIDA paperwork keeps piling up.",
    solution: {
      icon: Link2,
      title: "Payroll on the same rhythm as your books.",
      body: "Payslips, EMP201, UIF and COIDA run on their cycles next to your VAT201. New hires and the VAT registration are set up properly from the start, and EMP501 is ready when it's due.",
    },
  },
  {
    icon: Clock,
    title: "Too much owner involvement",
    body: "Your evenings go on chasing slips and answering basic finance questions. The work doesn't stop. The growth does.",
    solution: {
      icon: Zap,
      title: "The decisions stay yours.",
      body: "You send what we ask for, we run the month, and we talk the numbers through with you.",
    },
  },
];

export function ProblemCards() {
  // Each card flips on its own, so the reader turns problems into answers one at a time.
  const [resolved, setResolved] = useState<boolean[]>(() =>
    PROBLEMS.map(() => false),
  );
  const toggle = (i: number) =>
    setResolved((prev) => prev.map((v, j) => (j === i ? !v : v)));
  const prefersReducedMotion = useReducedMotion();

  const flipInitial = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, rotateX: 90 };
  const flipAnimate = prefersReducedMotion
    ? { opacity: 1 }
    : { opacity: 1, rotateX: 0 };
  const flipExit = prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, rotateX: -90 };
  const flipTransition = prefersReducedMotion
    ? { duration: 0.15 }
    : { duration: 0.4, ease: "backOut" as const };

  return (
    <section className="premium-section py-14 lg:py-20">
      <SectionDivider />
      <div className="max-w-7xl mx-auto px-6">
        <ScrollReveal>
          <SectionHeading
            title="Your business has outgrown a year-end accountant"
            subtitle="You hear from them once a year, with a bill. Meanwhile EMP201, VAT201 and provisional tax keep coming, and you're the one chasing."
          />
        </ScrollReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 min-h-[280px] mt-12">
          {PROBLEMS.map((item, i) => {
            const isResolved = resolved[i];
            return (
            <div
              key={item.title}
              className="h-full"
              style={{ perspective: "1000px" }}
            >
              <ScrollReveal delay={i * 0.08} className="h-full">
                <div
                  data-state={isResolved ? "solution" : "problem"}
                  className={cn(
                    "problem-card premium-card h-full rounded-2xl border p-6 flex flex-col transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    isResolved
                      ? "border-primary/30 bg-card shadow-[0_0_20px_rgba(45,212,255,0.05)]"
                      : "border-destructive/30 bg-destructive/5",
                  )}
                >
                  <AnimatePresence mode="wait">
                    {!isResolved ? (
                      <motion.div
                        key="problem"
                        initial={flipInitial}
                        animate={flipAnimate}
                        exit={flipExit}
                        transition={flipTransition}
                        className="flex-1 origin-center"
                      >
                        <div className="mb-4 flex items-center gap-3">
                          <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-destructive/15 bg-destructive/10">
                            <item.icon className="h-5 w-5 text-destructive animate-pulse" />
                          </div>
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-destructive/80">
                            The Problem
                          </div>
                        </div>
                        <h3 className="text-base font-semibold mb-2">
                          {item.title}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {item.body}
                        </p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="solution"
                        initial={flipInitial}
                        animate={flipAnimate}
                        exit={flipExit}
                        transition={flipTransition}
                        className="flex-1 origin-center"
                      >
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    data-state={isResolved ? "solution" : "problem"}
                    className={cn(
                      "flip-cue mt-5 self-start inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold",
                      isResolved
                        ? "border-white/10 text-muted-foreground"
                        : "border-primary/30 bg-primary/10 text-primary",
                    )}
                  >
                    {isResolved ? (
                      <>
                        <RotateCcw className="h-4 w-4" aria-hidden />
                        Back to the problem
                      </>
                    ) : (
                      <>
                        We can fix this
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </>
                    )}
                  </button>
                </div>
              </ScrollReveal>
            </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
