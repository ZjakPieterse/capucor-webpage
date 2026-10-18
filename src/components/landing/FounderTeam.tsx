import Image from "next/image";
import { Check, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionDivider } from "@/components/ui/SectionDivider";

// Founder/Team section, between Your first 90 days and the final CTA (audit
// decision 4, 2026-10-13). Team voice: no personal name in customer-facing
// copy (decision 2026-10-08), so the card names a role, not a person.
//
// FIRST DRAFT. Every line with `confirm: true` is unsourced and renders with a
// dashed "to confirm" underline until the owner signs it off; remove the flag
// (or the line) once confirmed. Delete the `.draft-copy` rule in globals.css
// when no flag is left.

/** Portrait, 4:5. Set to e.g. "/team/founder.jpg" (in public/) once supplied. */
const PHOTO: string | null = null;
const PHOTO_ALT = "The founder of Capucor Business Solutions";

type Line = { text: string; confirm?: boolean };

const ROLE: Line = { text: "Founder and lead accountant", confirm: true };

const STORY: Line[] = [
  {
    text: "Capucor has run the books, payroll and SARS work of South African businesses for more than ten years, from Centurion.",
    confirm: true,
  },
  {
    text: "We started it for owners who only heard from their accountant at year-end, with a bill. Your month is run by the accountant you talk to at your review, and that stays true as the team grows.",
    confirm: true,
  },
];

const CREDENTIALS: Line[] = [
  { text: "AGA(SA), a SAICA designation" },
  { text: "Xero Gold Partner", confirm: true },
  { text: "More than ten years in practice", confirm: true },
  { text: "Based in Centurion, Gauteng" },
];

function Copy({ line }: { line: Line }) {
  return (
    <span
      className={cn(line.confirm && "draft-copy")}
      title={line.confirm ? "Draft: to confirm" : undefined}
    >
      {line.text}
    </span>
  );
}

export function FounderTeam() {
  return (
    <section id="team" className="premium-section py-14 lg:py-20">
      <SectionDivider />
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-6">
        <ScrollReveal>
          <SectionHeading
            title="Who runs your month"
            subtitle="A small practice in Centurion, led by a SAICA-designated accountant. You hear from the same accountant every month."
          />
        </ScrollReveal>

        <div className="mt-12 grid items-center gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12">
          <ScrollReveal className="mx-auto w-full max-w-[240px] sm:max-w-xs md:max-w-none">
            {PHOTO ? (
              <Image
                src={PHOTO}
                alt={PHOTO_ALT}
                width={1200}
                height={1500}
                sizes="(min-width: 768px) 380px, 320px"
                className="aspect-[4/5] w-full rounded-2xl border border-white/10 object-cover"
              />
            ) : (
              // Placeholder slot: no stock face. Same footprint as the photo.
              <div
                role="img"
                aria-label="Photo to come"
                className="founder-photo-slot flex aspect-[4/5] w-full flex-col items-center justify-center gap-4 rounded-2xl"
              >
                <span aria-hidden className="svc-icon">
                  <UserRound className="h-[22px] w-[22px]" />
                </span>
                <span className="text-sm text-muted-foreground">Photo to come</span>
              </div>
            )}
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <article className="svc-card relative rounded-2xl border border-white/10 bg-card/80 p-6 sm:p-7">
              <p className="text-sm font-medium text-primary">
                <Copy line={ROLE} />
              </p>

              <div className="mt-4 space-y-4 text-base leading-relaxed text-muted-foreground">
                {STORY.map((line) => (
                  <p key={line.text}>
                    <Copy line={line} />
                  </p>
                ))}
              </div>

              <ul className="mt-6 grid gap-2.5 border-t border-white/10 pt-5 sm:grid-cols-2">
                {CREDENTIALS.map((line) => (
                  <li key={line.text} className="flex items-start gap-2.5 text-sm">
                    <span className="svc-check" aria-hidden>
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <Copy line={line} />
                  </li>
                ))}
              </ul>
            </article>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
