/**
 * Constant-time string comparison for secrets (revalidate/cron tokens,
 * webhook signatures). Plain `===`/`!==` short-circuits on the first
 * differing character, which leaks timing information an attacker can use
 * to recover the secret byte by byte.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);

  // A length mismatch is already public information (the comparison can't
  // hide it), so fold it into the accumulator instead of returning early.
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}
