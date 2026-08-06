/**
 * Structured logging.
 *
 * WHY. Workers Logs (enabled in wrangler.jsonc since 2026-08-03) captures
 * whatever the Worker writes to the console. Before this file, every call site
 * used its own ad-hoc `console.error('[SOME/TAG] thing:', err)` shape, so the
 * only way to find anything was a substring search over free text, and the
 * useful context — which org, which proposal, which route — was usually
 * interpolated into a message string or missing entirely.
 *
 * Emitting one line of JSON per event makes the log filterable in the
 * Cloudflare dashboard: you can query on `evt` to find every occurrence of a
 * failure mode, or on `orgId` to reconstruct what one client actually hit.
 *
 * Deliberately dependency-free and tiny. This is not an APM. Sentry and friends
 * were considered and deferred: Workers Logs plus error boundaries close the
 * "no trace at all" gap for zero cost and zero bundle weight, and there is not
 * yet enough traffic to justify more.
 *
 * CONVENTIONS
 * - `evt` is a dotted, stable, greppable identifier: `area.thing_that_happened`.
 *   Treat it as an API — renaming one breaks any saved query built on it.
 * - Never put anything secret in `fields`. These lines are retained by
 *   Cloudflare. Ids are fine; tokens, signature images and API keys are not.
 * - Errors go through `err`, which normalises Error / string / unknown. Do not
 *   pass a raw Error as a field — it serialises to `{}`.
 */

type Fields = Record<string, unknown>;

// Error instances do not survive JSON.stringify (name/message/stack are all
// non-enumerable), so an untreated `{ err }` field logs as `{}` — which is how
// you end up with a log line that records that something failed but not what.
function normaliseError(err: unknown): Fields {
  if (err instanceof Error) {
    return { err: err.message, errName: err.name, stack: err.stack };
  }
  if (typeof err === 'string') return { err };
  return { err: String(err) };
}

function emit(level: 'error' | 'warn' | 'info', evt: string, fields: Fields = {}) {
  const line = JSON.stringify({ level, evt, at: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/** Something failed that a human may need to investigate. */
export function logError(evt: string, err?: unknown, fields: Fields = {}) {
  emit('error', evt, err === undefined ? fields : { ...fields, ...normaliseError(err) });
}

/** Degraded but handled — a retry that failed, a non-fatal email send. */
export function logWarn(evt: string, fields: Fields = {}) {
  emit('warn', evt, fields);
}

/** Notable success worth being able to correlate against later. */
export function logInfo(evt: string, fields: Fields = {}) {
  emit('info', evt, fields);
}
