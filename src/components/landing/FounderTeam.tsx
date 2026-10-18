import Image from "next/image";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { TypedHeading } from "@/components/ui/TypedHeading";

// Meet the founder, between Your first 90 days and the final CTA (audit
// decision 4, 2026-10-13). The one deliberate exception to team voice (Zjak,
// 2026-10-18): visitors meet a real face and name here, told as a short
// first-person story. Everywhere else the site still speaks as "we". No
// location, no dates, no business types beyond "an online store", and no other
// firm or person named. Every line was confirmed by Zjak in the founder
// interview (2026-10-18); change none of it without him.
//
// Layout (Zjak, 2026-10-18): no section heading; the card carries "Meet the
// founder" and the story in plain body text. Desktop: portrait beside the card.
// Phones: no big portrait, a small round photo by the signature instead.

/** Portrait, 4:5. Set to e.g. "/team/founder.jpg" (in public/) once supplied. */
const PHOTO: string | null = null;

const FOUNDER = {
  name: "Zjak Pieterse",
  credential: "Founder · AGA(SA)",
};

const STORY = [
  "I studied accounting to understand how businesses really work, because I wanted to own one. While I was still training, family and friends started asking me for help, and word spread.",
  "In more than 15 years in the industry, I've kept meeting owners who pay an accountant and still can't say whether they made a profit. One online store kept every supplier invoice in printed ring binders for their accountant, and all they got back was a VAT bill. Today most of their orders flow into the books on their own, we talk about what's next, and they've gone from working past midnight most days to taking a day off for golf.",
  "So every way of working at Capucor has to pass one test: does it give you back time, or show you something you couldn't see? What I want is for you to tell another owner: “Look, this just works.”",
];

function Photo({ className, sizes, label }: { className?: string; sizes: string; label?: boolean }) {
  return PHOTO ? (
    <Image
      src={PHOTO}
      alt={`${FOUNDER.name}, founder of Capucor Business Solutions`}
      width={1200}
      height={1500}
      sizes={sizes}
      className={cn("w-full border border-white/10 object-cover", className)}
    />
  ) : (
    // Placeholder slot: no stock face. Same footprint as the photo.
    <div
      role="img"
      aria-label="Photo to come"
      className={cn("founder-photo-slot flex w-full flex-col items-center justify-center gap-4", className)}
    >
      <span aria-hidden className="svc-icon">
        <UserRound className="h-[22px] w-[22px]" />
      </span>
      {label && <span className="text-sm text-muted-foreground">Photo to come</span>}
    </div>
  );
}

export function FounderTeam() {
  return (
    <section id="founder" className="premium-section py-14 lg:py-20">
      <SectionDivider />
      <div className="mx-auto grid w-full max-w-5xl items-center gap-8 px-5 sm:px-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12">
        <ScrollReveal className="hidden md:block">
          <Photo label sizes="380px" className="aspect-[4/5] rounded-2xl" />
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <article className="svc-card relative rounded-2xl border border-white/10 bg-card/80 p-6 sm:p-8">
            <TypedHeading
              text="Meet the founder"
              className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
            />
            <div className="mt-5 space-y-4 text-base leading-relaxed text-muted-foreground">
              {STORY.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-4 border-t border-white/10 pt-5">
              <div className="w-14 shrink-0 md:hidden">
                <Photo sizes="56px" className="aspect-square rounded-full" />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight text-foreground">{FOUNDER.name}</p>
                <p className="mt-0.5 text-sm font-medium text-primary">{FOUNDER.credential}</p>
              </div>
            </div>
          </article>
        </ScrollReveal>
      </div>
    </section>
  );
}
