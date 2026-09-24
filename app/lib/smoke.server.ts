/**
 * The SMOKE credential: a read-only machine principal for the admin plane, so `check:browser` can
 * sweep the authenticated admin unattended rather than being handed the single admin's own session
 * cookie.
 *
 * **IT IS ITS OWN PRINCIPAL, NOT A COPY OF THE ADMIN'S SESSION.** It READS AND CANNOT WRITE, and not
 * by convention: `decide()` and `decideDelete()` refuse it from the capability table, and the
 * `/admin` middleware refuses every non-GET method before an action runs. It is revocable alone, and
 * it is storable as a secret, which a Better Auth session cookie is not.
 *
 * Storage and lifecycle are the OPERATOR TOKEN's exactly: never on a command line, never in a log,
 * never in an error body. What a read still exposes is stated on the `smoke` row of
 * `WRITE_CAPABILITIES` in `app/lib/editor/publish-policy.mjs`, where the kind is defined.
 */

import { constantTimeEqual, tokenLabel } from "~/lib/bearer.server";

/**
 * ITS OWN RATE-LIMIT KEY PREFIX on the existing Durable Object, joining `ip:`, `auth:`, `op:`,
 * `preview:` and `csp:`, so the two cannot exhaust each other: a CI sweep must never lock the
 * publish path out, and a runaway agent must never make the browser gate report a layout failure
 * that is really a 429.
 *
 * **THE CEILING IS DELIBERATELY HIGH**, because nothing behind it spends money: every request it
 * admits is a D1 read the admin plane already does. Its job is to bound what a LEAKED token could
 * draw and to stop a runaway harness. A legitimate sweep is a burst of tens of loads in a few
 * seconds, which a tight limit would refuse for nothing.
 */
const SMOKE_RATE_LIMIT = 240;
const SMOKE_RATE_PERIOD_SECONDS = 60;

/** Minimum token length, the operator's floor. A short secret is a misconfiguration. */
const MIN_TOKEN_LENGTH = 32;

/**
 * The outcome of presenting a smoke credential.
 *
 * `absent` is NOT a failure and is its own state. The overwhelming majority of
 * requests to `/admin` carry no bearer token at all, because they are Dustin in
 * a browser, and the middleware must fall through to the ordinary session gate
 * rather than reporting anything. Collapsing this into `ok: false` would make
 * every human page load look like a rejected credential.
 */
export type SmokeResult =
  | { kind: "ok"; id: string; email: string }
  | { kind: "absent" }
  | { kind: "refused"; status: number; error: string; retryAfter?: number };

/**
 * Authenticates a smoke bearer token and consumes one unit of its rate budget.
 *
 * Order matches the operator path and for the same reason: authenticate FIRST,
 * then rate limit, so an unauthenticated flood cannot exhaust the real
 * credential's budget or reach a Durable Object at all.
 */
export async function authenticateSmoke(env: Env, request: Request): Promise<SmokeResult> {
  const header = request.headers.get("authorization") ?? "";
  const presented = /^Bearer\s+(.+)$/i.exec(header.trim())?.[1] ?? "";

  // No bearer token means this is an ordinary browser request. Say so and let
  // the session gate answer, without touching the secret or the limiter.
  if (!presented) return { kind: "absent" };

  const configured = env.SMOKE_TOKEN;

  /*
   * NOT CONFIGURED MEANS NOT OPEN, the operator path's stance verbatim.
   *
   * Refused rather than fallen through, because a bearer token WAS presented:
   * falling through would answer a credentialed request with a login redirect
   * and send whoever wired up CI to debug the wrong thing.
   */
  if (!configured || configured.length < MIN_TOKEN_LENGTH) {
    return {
      kind: "refused",
      status: 503,
      error:
        "The smoke credential is not configured on this deployment. " +
        "Set the SMOKE_TOKEN wrangler secret to enable it.",
    };
  }

  // Compared even though `presented` is known non-empty, so a wrong token and a
  // malformed one take the same path and the same time.
  if (!(await constantTimeEqual(presented, configured))) {
    return { kind: "refused", status: 401, error: "Invalid smoke bearer token." };
  }

  const id = tokenLabel(presented);

  if (!env.ASK_BUDGET) {
    // The stance the Ask guards and the operator path take: a privileged
    // endpoint without its limiter does not serve unprotected, it does not serve.
    return {
      kind: "refused",
      status: 503,
      error: "Rate limiting is unavailable, so the smoke credential is disabled.",
    };
  }

  const limiter = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName(`smoke:${id}`));
  const { ok } = await limiter.hit(SMOKE_RATE_LIMIT, SMOKE_RATE_PERIOD_SECONDS);
  if (!ok) {
    return {
      kind: "refused",
      status: 429,
      error: `Rate limit: ${SMOKE_RATE_LIMIT} requests per ${SMOKE_RATE_PERIOD_SECONDS} seconds.`,
      retryAfter: SMOKE_RATE_PERIOD_SECONDS,
    };
  }

  /*
   * THE EMAIL IS RESOLVED HERE, INSIDE THE BOUNDARY. `admin.tsx` is a ROUTE and the secrets-boundary rule is a PATH
   * rule, so a route reading a ratified secret is a violation whether or not the value ever leaves the
   * server. The session path already resolves the address inside `auth.server.ts`, so neither kind of
   * caller's route touches the secret.
   *
   * Empty string when unset, matching `getAdminSession`. Not a substituted placeholder: an empty
   * topbar label is visibly wrong, where an invented one would quietly move the layout measurement
   * this credential exists to take.
   */
  return { kind: "ok", id, email: env.ADMIN_EMAIL ?? "" };
}
