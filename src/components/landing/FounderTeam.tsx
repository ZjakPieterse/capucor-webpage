import Image from "next/image";
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

/** Zjak's own photo (2026-10-18), cropped from one shot: a 4:5 portrait for
 *  desktop and a face crop for the phone's round photo. Never a stock face. */
const PHOTO = { portrait: "/team/founder.jpg", face: "/team/founder-avatar.jpg" };

const FOUNDER = {
  name: "Zjak Pieterse",
  credential: "Founder · AGA(SA)",
};

const STORY = [
  "I studied accounting to understand how businesses really work, because I wanted to own one. While I was still training, family and friends started asking me for help, and word spread.",
  "In more than 15 years in the industry, I've kept meeting owners who pay an accountant and still can't say whether they made a profit. One online store kept every supplier invoice in printed ring binders for their accountant, and all they got back was a VAT bill. Today most of their orders flow into the books on their own, we talk about what's next, and they've gone from working past midnight most days to taking a day off for golf.",
  "So every way of working at Capucor has to pass one test: does it give you back time, or show you something you couldn't see? What I want is for you to tell another owner: “Look, this just works.”",
];

const ALT = `${FOUNDER.name}, founder of Capucor Business Solutions`;

export function FounderTeam() {
  return (
    <section id="founder" className="premium-section py-14 lg:py-20">
      <SectionDivider />
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 sm:px-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12">
        {/* The photo fills the card's height so both share a top and bottom edge
            (Zjak, 2026-10-18); the crop keeps the face in view. */}
        <ScrollReveal className="relative hidden md:block">
          <Image
            src={PHOTO.portrait}
            alt={ALT}
            fill
            sizes="(min-width: 1152px) 420px, 40vw"
            className="rounded-2xl border border-white/10 object-cover object-[45%_25%]"
          />
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <article className="svc-card relative h-full rounded-2xl border border-white/10 bg-card/80 p-6 sm:p-8">
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
                <Image
                  src={PHOTO.face}
                  alt={ALT}
                  width={240}
                  height={240}
                  sizes="56px"
                  className="aspect-square w-full rounded-full border border-white/10 object-cover"
                />
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
