/**
 * Read-only machine principal for the admin plane: `decide()` refuses it writes and the `/admin`
 * middleware refuses non-GET methods. Handle it like the operator token: never in a log or error body.
 */

import { constantTimeEqual, tokenLabel } from "~/lib/bearer.server";
import { limitHit } from "~/lib/rate-limit.mjs";

/**
 * Own `smoke:` key prefix so a CI sweep and the publish path cannot exhaust each other. High because
 * nothing behind it costs money and a legitimate sweep bursts tens of loads in seconds.
 */
const SMOKE_RATE_LIMIT = 240;
const SMOKE_RATE_PERIOD_SECONDS = 60;

const MIN_TOKEN_LENGTH = 32;

// `absent` is not a failure: most `/admin` requests are a browser and must fall through to the session gate.
type SmokeResult =
  | { kind: "ok"; id: string; email: string }
  | { kind: "absent" }
  | { kind: "refused"; status: number; error: string; retryAfter?: number };

// Authenticate before rate limiting, so an unauthenticated flood cannot drain the real budget.
export async function authenticateSmoke(env: Env, request: Request): Promise<SmokeResult> {
  const header = request.headers.get("authorization") ?? "";
  const presented = /^Bearer\s+(.+)$/i.exec(header.trim())?.[1] ?? "";

  if (!presented) return { kind: "absent" };

  const configured = env.SMOKE_TOKEN;

  // Refused, not fallen through: a token was presented, and a login redirect would mislead CI.
  if (!configured || configured.length < MIN_TOKEN_LENGTH) {
    return {
      kind: "refused",
      status: 503,
      error:
        "The smoke credential is not configured on this deployment. " +
        "Set the SMOKE_TOKEN wrangler secret to enable it.",
    };
  }

  if (!(await constantTimeEqual(presented, configured))) {
    return { kind: "refused", status: 401, error: "Invalid smoke bearer token." };
  }

  const id = tokenLabel(presented);

  const verdict = await limitHit(env, `smoke:${id}`, SMOKE_RATE_LIMIT, SMOKE_RATE_PERIOD_SECONDS);
  if (verdict === "unavailable") {
    return {
      kind: "refused",
      status: 503,
      error: "Rate limiting is unavailable, so the smoke credential is disabled.",
    };
  }
  if (verdict === "limited") {
    return {
      kind: "refused",
      status: 429,
      error: `Rate limit: ${SMOKE_RATE_LIMIT} requests per ${SMOKE_RATE_PERIOD_SECONDS} seconds.`,
      retryAfter: SMOKE_RATE_PERIOD_SECONDS,
    };
  }

  // Resolved here, not in `admin.tsx`: the secrets boundary is a path rule and routes may not read secrets.
  return { kind: "ok", id, email: env.ADMIN_EMAIL ?? "" };
}
