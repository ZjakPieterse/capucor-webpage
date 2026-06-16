// A signed/active proposal becomes "review due" once its signature is 3+ months
// old. This matches the rolling quarterly-review clause in the engagement terms
// (config/proposalTerms.ts → 'period-review': "We review the engagement every
// quarter…"). Pure and dependency-free so both the internal hub (PR13b) and the
// amend flow (PR13c) can reuse it without pulling in client code.

export const REVIEW_DUE_MONTHS = 3;

// Only proposals that are actually live carry a review obligation.
const REVIEW_STATUSES = new Set(['signed', 'active']);

export function isReviewDue(
  status: string,
  signedAtIso: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!REVIEW_STATUSES.has(status)) return false;
  if (!signedAtIso) return false;

  const signedAt = new Date(signedAtIso);
  if (Number.isNaN(signedAt.getTime())) return false;

  // Date as of REVIEW_DUE_MONTHS ago; anything signed at or before it is due.
  const threshold = new Date(now);
  threshold.setMonth(threshold.getMonth() - REVIEW_DUE_MONTHS);

  return signedAt.getTime() <= threshold.getTime();
}
