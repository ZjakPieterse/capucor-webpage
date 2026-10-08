"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { useSectionScrollProgress } from "@/hooks/useSectionScrollProgress";

const STEPS = [
  {
    number: "01",
    title: "Collect",
    body: "You know exactly what to send, where to send it, and by when. We make the monthly admin clear and repeatable, so both sides can deliver properly.",
    deliverable:
      "Your bank feeds flow straight into Xero, supplier bills go through Dext on Pro and Premium, and once a month we send one request for anything still missing.",
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
    body: "Your accountant checks the numbers before they reach you. You receive an Insights Report on your package’s rhythm (quarterly on Basic, monthly on Pro, weekly on Premium) showing performance, cash flow, debtors and anything that needs attention.",
    deliverable:
      "A concise view of revenue, expenses, cash flow, debtors and anything unusual that deserves attention, for each reporting period.",
  },
  {
    number: "04",
    title: "Advise",
    body: "At your performance review, on the same rhythm as your report, we turn it into a useful business conversation: tax timing, cash pressure, margin movement, compliance risks and practical next steps.",
    deliverable:
      "Risks, opportunities and planning points raised early, while there is still time to act on them.",
  },
];

export function HowItWorks() {
  const { ref: sectionRef } = useSectionScrollProgress<HTMLElement>();

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="how-timeline-section premium-section"
    >
      <SectionDivider />
      <div className="mx-auto w-full max-w-6xl px-6">
        <SectionHeading
          title="A monthly rhythm that keeps you in control"
          subtitle="Great finance work needs a clear monthly rhythm. We process, review, report and advise so the month closes properly."
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
