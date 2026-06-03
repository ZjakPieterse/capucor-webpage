"use client";

import type { CSSProperties } from "react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { useSectionScrollProgress } from "@/hooks/useSectionScrollProgress";

const STEPS = [
  {
    number: "01",
    title: "Collect",
    body: "You know exactly what to send, where to send it, and by when. We make the monthly admin clear and repeatable, so both sides can deliver properly.",
    deliverable:
      "Clear monthly requests and one structured place for your information to flow, so there are fewer follow-ups and nothing gets lost in email.",
  },
  {
    number: "02",
    title: "Process",
    body: "We capture, code and reconcile the month’s activity in Xero, including bank feeds, supplier invoices, payroll entries and key control accounts.",
    deliverable:
      "Your ledger stays reconciled and decision-ready, with tax and compliance deadlines tracked through the workflow. When someone needs a number, you are not scrambling to catch up.",
  },
  {
    number: "03",
    title: "Review",
    body: "A senior accountant checks the numbers before they reach you. You receive a clear monthly report showing performance, cash flow, debtors and anything that needs attention.",
    deliverable:
      "A concise monthly view of revenue, expenses, cash flow, debtors and anything unusual that deserves attention.",
  },
  {
    number: "04",
    title: "Advise",
    body: "We turn the report into useful business conversation: tax timing, cash pressure, margin movement, compliance risks and practical next steps.",
    deliverable:
      "Risks, opportunities and planning points raised early, while there is still time to act on them.",
  },
];

export function HowItWorks() {
  const { ref: sectionRef, progress } = useSectionScrollProgress<HTMLElement>();

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="how-timeline-section premium-section"
    >
      <SectionDivider />
      <div className="mx-auto w-full max-w-6xl px-6">
        <SectionHeading
          eyebrow="HOW WE WORK"
          title="A monthly rhythm that keeps you in control"
          subtitle="Great finance work needs a clear monthly rhythm. We process, review, report and advise so the month closes properly."
        />

        <div
          className="how-timeline mt-12"
          style={{ "--scroll-progress": progress } as CSSProperties}
        >
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
                <header className="how-card-header">
                  <span className="how-card-number" aria-hidden="true">
                    {step.number}
                  </span>
                  <h3 className="how-card-title">{step.title}</h3>
                </header>
                <p className="how-card-body">{step.body}</p>
                <div className="how-card-you-get">
                  <span className="how-card-you-get-label">You get</span>
                  <p className="how-card-you-get-text">{step.deliverable}</p>
                </div>
              </article>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
