import Link from 'next/link';

// The POPIA s18 notice shown under every form that collects personal
// information (privacy notice v2, Zjak 2026-11-06). It replaces the required
// "I consent" checkbox: replying to a visitor who asked us to rests on
// POPIA s11(1)(b), not on consent, so consent is no longer a condition of
// sending a form. If a marketing opt-in is ever needed, add it as its own
// optional, unticked box; never make it required.
interface PrivacyNoticeProps {
  // What we will use the details for (default: replying to an enquiry).
  purpose?: string;
}

export function PrivacyNotice({ purpose = 'reply to you' }: PrivacyNoticeProps) {
  return (
    <p className="text-sm text-muted-foreground leading-relaxed">
      We&apos;ll use these details to {purpose}. Our{' '}
      <Link href="/privacy" className="text-primary underline underline-offset-2 hover:no-underline">
        Privacy Policy
      </Link>{' '}
      explains what we keep, for how long, and your rights.
    </p>
  );
}
