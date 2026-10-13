// Calculator focus management (full-site audit A14, 2026-10-13). After every
// move the new screen's heading takes focus, so keyboard and screen-reader
// users land on the question instead of on <body>. Each screen marks its
// heading with `data-step-heading` and `tabIndex={-1}`.

export const STEP_HEADING_SELECTOR = '[data-step-heading]';

/** Focuses the step heading inside `screen`. False when there is none. */
export function focusStepHeading(screen: Pick<ParentNode, 'querySelector'> | null): boolean {
  const heading = screen?.querySelector<HTMLElement>(STEP_HEADING_SELECTOR);
  if (!heading) return false;
  // The calculator already scrolls to the top on every move.
  heading.focus({ preventScroll: true });
  return true;
}
