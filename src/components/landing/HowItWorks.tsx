"use client";

import { useEffect } from "react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { useSectionScrollProgress } from "@/hooks/useSectionScrollProgress";

// One ideal client's month, told to the reader. No package frequency here on
// purpose: the story is the rhythm, the packages page carries the cadence.
const STEPS = [
  {
    number: "01",
    title: "Collect",
    body: "The month ends. Instead of a shoebox and a sinking feeling, one email arrives with a short list of what we still need. Your bank feeds are already in Xero. You snap the last two slips, reply, and get back to work.",
  },
  {
    number: "02",
    title: "Process",
    body: "While you're quoting the next job, we're in your books. Every transaction coded, every account reconciled, payroll and VAT lined up for their deadlines. You never see this part. That's the point.",
  },
  {
    number: "03",
    title: "Review",
    body: "Before anything reaches you, your accountant checks it. Then your Insights Report lands: what came in, what went out, who still owes you, and the two things worth a closer look.",
  },
  {
    number: "04",
    title: "Advise",
    body: "Now we talk it through. Can you hire before winter? Is provisional tax going to bite? You leave with a plan, and the next month is already under way.",
  },
];

export function HowItWorks() {
  const { ref: sectionRef } = useSectionScrollProgress<HTMLElement>();

  // A step lights up once its badge passes the viewport centre, which is where
  // the spine's fill tip sits. Written to the DOM, not state, so scrolling
  // never re-renders the section (home-hydration).
  useEffect(() => {
    const rows = sectionRef.current?.querySelectorAll<HTMLElement>(".how-step-row");
    if (!rows?.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      rows.forEach((row) => (row.dataset.reached = ""));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const row = entry.target.closest<HTMLElement>(".how-step-row");
          if (!row) continue;
          // Above the centre line (intersecting, or scrolled past the top) = reached.
          const reached = entry.isIntersecting || entry.boundingClientRect.top < 0;
          if (reached) row.dataset.reached = "";
          else delete row.dataset.reached;
        }
      },
      { rootMargin: "0px 0px -50% 0px" },
    );
    rows.forEach((row) => {
      const badge = row.querySelector(".how-badge");
      if (badge) io.observe(badge);
    });
    return () => io.disconnect();
  }, [sectionRef]);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="how-timeline-section premium-section"
    >
      <SectionDivider />
      <div className="mx-auto w-full max-w-6xl px-6">
        <SectionHeading
          title="A rhythm that keeps you in control"
          subtitle="Great finance work needs a clear rhythm. We process, review, report, and advise. Every period closes on time and reconciled, leaving you with the insights you need for your next move."
        />

        <div className="how-timeline mt-12">
          <div className="how-spine" aria-hidden="true" />
          {STEPS.map((step, i) => (
            <div
              key={step.number}
              className="how-step-row"
              data-side={i % 2 === 0 ? "left" : "right"}
            >
              <div className="how-badge" aria-hidden="true">
                {step.number}
              </div>
              <article
                className="how-card"
                aria-label={`Step ${step.number}: ${step.title}`}
              >
                <h3 className="how-card-title">{step.title}</h3>
                <p className="how-card-body">{step.body}</p>
              </article>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
