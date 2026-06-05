'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConsentCheckbox } from '@/components/ui/ConsentCheckbox';
import { cn } from '@/lib/utils';
import { monthlyTotal } from '@/lib/pricing';
import { siteConfig } from '@/config/site';
import type { Bracket, BracketValue, Service, Tier } from '@/types';

interface SavingsCalculatorProps {
  services: Service[];
  brackets: Bracket[];
  tiers: Tier[];
}

const formatZAR = (n: number) => `R ${Math.round(n).toLocaleString('en-US')}`;

// A sober, on-page comparison of running finance in-house versus a fixed Capucor
// subscription. The Capucor figure is computed with the same monthlyTotal() the
// real pricing calculator uses, so the two never disagree. Submitting the email
// capture stores a lead with source='roi' (config carries the selection).
export function SavingsCalculator({ services, brackets, tiers }: SavingsCalculatorProps) {
  const sortedTiers = useMemo(
    () => [...tiers].sort((a, b) => a.display_order - b.display_order),
    [tiers]
  );

  const bracketsByService = useMemo(() => {
    const map: Record<string, Bracket[]> = {};
    for (const b of brackets) {
      if (b.is_enterprise) continue;
      (map[b.service_slug] ??= []).push(b);
    }
    for (const slug of Object.keys(map)) {
      map[slug].sort((a, b) => a.ordinal - b.ordinal);
    }
    return map;
  }, [brackets]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bracketSel, setBracketSel] = useState<Record<string, number>>({});
  const [tierSlug, setTierSlug] = useState<string>(sortedTiers[0]?.slug ?? 'basic');
  const [inHouse, setInHouse] = useState('15000');

  // Email capture
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (services.length === 0 || brackets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground leading-relaxed">
        Our cost estimate is unavailable right now. You can{' '}
        <Link href="/pricing" className="text-primary underline underline-offset-2">
          build your subscription
        </Link>{' '}
        to see exact pricing, or send us a message and we&apos;ll help.
      </p>
    );
  }

  function toggleService(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
        setBracketSel((b) => {
          const nb = { ...b };
          delete nb[slug];
          return nb;
        });
      } else {
        next.add(slug);
        const first = bracketsByService[slug]?.[0]?.ordinal;
        if (first !== undefined) {
          setBracketSel((b) => ({ ...b, [slug]: first }));
        }
      }
      return next;
    });
  }

  const selectedSlugs = [...selected];
  const hasSelection = selectedSlugs.length > 0;

  const capucorMonthly = monthlyTotal(
    selectedSlugs,
    bracketSel as Record<string, BracketValue>,
    tierSlug,
    brackets
  );
  const inHouseNum = Math.max(0, parseInt(inHouse, 10) || 0);
  const diff = inHouseNum - capucorMonthly;
  const tierName = sortedTiers.find((t) => t.slug === tierSlug)?.name ?? 'Basic';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!consent) {
      setError('Please tick the consent box so we can send it.');
      return;
    }

    const selectedNames = selectedSlugs.map(
      (slug) => services.find((s) => s.slug === slug)?.name ?? slug
    );
    const summary =
      `ROI estimate — Capucor ${formatZAR(capucorMonthly)}/mo (${tierName}) vs ` +
      `in-house ~${formatZAR(inHouseNum)}/mo. Services: ${selectedNames.join(', ') || 'none'}.`;

    setSubmitting(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          source: 'roi',
          name: name.trim(),
          email: email.trim(),
          message: summary,
          config: { services: selectedSlugs, brackets: bracketSel, tier: tierSlug },
          consent_given: true,
          website,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'Could not send your estimate. Please try again.');
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your estimate. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Service selection */}
      <div className="space-y-2.5">
        <p className="text-sm font-medium">What finance work do you need?</p>
        <div className="flex flex-wrap gap-2">
          {services.map((s) => {
            const active = selected.has(s.slug);
            return (
              <Button
                key={s.slug}
                type="button"
                size="sm"
                variant={active ? 'default' : 'outline'}
                aria-pressed={active}
                onClick={() => toggleService(s.slug)}
              >
                {s.name}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Size + tier inputs (appear once at least one service is chosen) */}
      {hasSelection && (
        <div className="space-y-4">
          {selectedSlugs.map((slug) => {
            const svc = services.find((s) => s.slug === slug);
            const opts = bracketsByService[slug] ?? [];
            return (
              <div key={slug} className="space-y-1.5">
                <Label htmlFor={`roi-${slug}`}>
                  {svc?.name}{' '}
                  {svc?.bracket_unit_label && (
                    <span className="text-muted-foreground font-normal">
                      ({svc.bracket_unit_label})
                    </span>
                  )}
                </Label>
                <select
                  id={`roi-${slug}`}
                  value={bracketSel[slug] ?? ''}
                  onChange={(e) =>
                    setBracketSel((b) => ({ ...b, [slug]: Number(e.target.value) }))
                  }
                  className="h-9 w-full rounded-lg border border-input bg-input/30 px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {opts.map((b) => (
                    <option key={b.ordinal} value={b.ordinal}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}

          <div className="space-y-1.5">
            <Label>Level of support</Label>
            <div className="flex flex-wrap gap-2">
              {sortedTiers.map((t) => (
                <Button
                  key={t.slug}
                  type="button"
                  size="sm"
                  variant={tierSlug === t.slug ? 'default' : 'outline'}
                  aria-pressed={tierSlug === t.slug}
                  onClick={() => setTierSlug(t.slug)}
                >
                  {t.name}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* In-house cost input */}
      <div className="space-y-1.5">
        <Label htmlFor="roi-inhouse">What you&apos;d spend doing this in-house</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            R
          </span>
          <Input
            id="roi-inhouse"
            type="number"
            inputMode="numeric"
            min={0}
            step={500}
            value={inHouse}
            onChange={(e) => setInHouse(e.target.value)}
            className="pl-7"
          />
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          A part-time bookkeeper plus software. Most SMEs land between R12,000 and R25,000 a
          month, before your own time.
        </p>
      </div>

      {/* Comparison */}
      {hasSelection && (
        <div className="rounded-xl border border-white/10 bg-card/60 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Roughly in-house
              </p>
              <p className="mt-1 text-xl font-semibold text-muted-foreground">
                {formatZAR(inHouseNum)}
                <span className="text-xs font-normal text-muted-foreground"> /mo</span>
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-primary">With Capucor</p>
              <p className="mt-1 text-xl font-semibold">
                {formatZAR(capucorMonthly)}
                <span className="text-xs font-normal text-muted-foreground"> /mo, fixed</span>
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            {diff > 0 ? (
              <>
                That&apos;s about {formatZAR(diff)} less each month, with software, SARS and CIPC
                compliance, and a qualified team included.
              </>
            ) : (
              <>
                Similar monthly cost. You hand over the compliance, software and admin, with no
                gap if a staff member leaves.
              </>
            )}
          </p>
        </div>
      )}

      {/* Email capture */}
      {done ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground leading-relaxed">
          Sent. We&apos;ve emailed this estimate to{' '}
          <span className="text-foreground font-medium">{email.trim()}</span> and will follow up
          if you&apos;d like to talk it through.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3 border-t border-white/10 pt-4" noValidate>
          <p className="text-sm font-medium">Want this estimate in writing?</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              type="text"
              autoComplete="name"
              aria-label="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name and Surname"
            />
            <Input
              type="email"
              autoComplete="email"
              inputMode="email"
              aria-label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@business.co.za"
            />
          </div>

          <ConsentCheckbox id="roi-consent" checked={consent} onCheckedChange={setConsent} />

          {/* Honeypot */}
          <div className="hidden" aria-hidden="true">
            <label htmlFor="roi-website">Website</label>
            <input
              id="roi-website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" /> Sending…
                </>
              ) : (
                'Email me the estimate'
              )}
            </Button>
            <a
              href={siteConfig.links.booking}
              target="_blank"
              rel="noopener noreferrer"
              className={cn('text-sm text-primary underline underline-offset-2 hover:no-underline')}
            >
              Prefer to talk? Book a fit call
            </a>
          </div>
        </form>
      )}
    </div>
  );
}
