/**
 * Rate limiting on the wrapper endpoint: the portfolio's one limiter
 * (@dustinedwards/site-runtime/rate-limit), a Durable Object counting with the
 * synchronous SQLite API. The class keeps its name, so the existing binding and
 * migration stay as they are.
 *
 * VERIFYING THIS NEEDS A CONCURRENT BURST. A sequential loop straddles the window
 * boundary and produces zero refusals, which reads exactly like a dead limiter.
 */

import { limit as hitLimit } from "@dustinedwards/site-runtime/rate-limit";
import { RateLimiter } from "@dustinedwards/site-runtime/rate-limit/durable-object";

/** Requests allowed per window, per identity. */
const LIMIT = 30;
/** Window length in seconds. */
const WINDOW_SECONDS = 60;

export class OperatorRateLimit extends RateLimiter {}

export interface RateLimitEnv {
  OPERATOR_RATE_LIMIT: DurableObjectNamespace<OperatorRateLimit>;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfter: number;
}

/**
 * Checks the limit for one identity. A caller may ask for a LOWER ceiling than
 * LIMIT (registration does), never a higher one.
 *
 * Fails CLOSED when the binding is absent or failing: an unprotected surface on
 * a write path must not serve.
 */
export async function checkRateLimit(
  env: Partial<RateLimitEnv>,
  identity: string,
  limit?: number,
): Promise<RateLimitDecision> {
  const ceiling = limit !== undefined && Number.isInteger(limit) && limit >= 1 && limit < LIMIT ? limit : LIMIT;
  const verdict = await hitLimit(env.OPERATOR_RATE_LIMIT as never, identity, [{ limit: ceiling, windowSeconds: WINDOW_SECONDS }], {
    onUnavailable: "refuse",
  });
  return {
    allowed: verdict.status === "ok",
    retryAfter: verdict.status === "unavailable" ? WINDOW_SECONDS : verdict.retryAfterSeconds,
  };
}
