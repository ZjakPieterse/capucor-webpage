import Image from "next/image";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SectionDivider } from "@/components/ui/SectionDivider";

// Meet the founder, between Your first 90 days and the final CTA (audit
// decision 4, 2026-10-13). The one deliberate exception to team voice (Zjak,
// 2026-10-18): visitors meet a real face and name here, told as a short
// first-person story. Everywhere else the site still speaks as "we". No
// location: the practice is presented as virtual. Credentials stay light here;
// they belong to the wider site.
//
// DRAFT. Every line with `confirm: true` renders with a dashed "to confirm"
// underline until the owner signs it off; text in [square brackets] is a gap
// only the owner can fill. Remove the flag once a line is final, and delete the
// `.draft-copy` rule in globals.css when no flag is left.

/** Portrait, 4:5. Set to e.g. "/team/founder.jpg" (in public/) once supplied. */
const PHOTO: string | null = null;

const FOUNDER = {
  name: "Zjak Pieterse",
  credential: "Founder · AGA(SA)",
};

type Line = { text: string; confirm?: boolean };

const STORY: Line[] = [
  {
    text: "I started Capucor more than ten years ago, after [what you saw or did before Capucor, e.g. years in practice watching owners hear from their accountant once a year, with a bill]. I wanted to be the accountant I'd want for my own business: close to the numbers every month, not only at year-end.",
    confirm: true,
  },
  {
    text: "Since then I've run the books, payroll and SARS work for owner-run businesses with staff, [the kinds of businesses you know best]. The pattern is always the same. The owner is good at the work, and the admin eats their evenings.",
    confirm: true,
  },
  {
    text: "So we built Capucor to run online, on a monthly rhythm, wherever you are. My job is simple: your month is handled, and you know what to do next.",
    confirm: true,
  },
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
    <section id="founder" className="premium-section py-14 lg:py-20">
      <SectionDivider />
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-6">
        <ScrollReveal>
          <SectionHeading
            title="Meet the founder"
            subtitle="The person behind Capucor, and why it works the way it does."
          />
        </ScrollReveal>

        <div className="mt-12 grid items-center gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12">
          <ScrollReveal className="mx-auto w-full max-w-[240px] sm:max-w-xs md:max-w-none">
            {PHOTO ? (
              <Image
                src={PHOTO}
                alt={`${FOUNDER.name}, founder of Capucor Business Solutions`}
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
            <article className="svc-card relative rounded-2xl border border-white/10 bg-card/80 p-6 sm:p-8">
              <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
                {STORY.map((line) => (
                  <p key={line.text}>
                    <Copy line={line} />
                  </p>
                ))}
              </div>

              <div className="mt-6 border-t border-white/10 pt-5">
                <p className="text-lg font-semibold tracking-tight text-foreground">
                  {FOUNDER.name}
                </p>
                <p className="mt-0.5 text-sm font-medium text-primary">{FOUNDER.credential}</p>
              </div>
            </article>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
