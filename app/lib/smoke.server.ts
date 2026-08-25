/**
 * The SMOKE credential: a read-only machine principal for the admin plane.
 *
 * Ruled 2026-08-24 under Dustin's standing automation directive. `check:browser`
 * could only reach the real authenticated admin by being handed the single
 * admin's own session cookie, pasted out of Chrome into a gitignored file, which
 * meant the admin cases had never once run unattended and the plane's layout
 * defects were found by Dustin clicking. This is the credential that moves that
 * sweep into CI.
 *
 * ## IT IS ITS OWN PRINCIPAL, NOT A COPY OF THE ADMIN'S SESSION
 *
 * Three properties, and each one is why this exists rather than a shared cookie:
 *
 *   LEAST PRIVILEGE  it reads and cannot write. Not by convention: `decide()`
 *                    and `decideDelete()` refuse it from the capability table,
 *                    and the `/admin` middleware refuses every non-GET method
 *                    before a single action runs. See `publish-policy.mjs`.
 *   REVOCABLE ALONE  `wrangler secret delete SMOKE_TOKEN` ends it and touches
 *                    nothing else. Revoking a leaked admin session means
 *                    invalidating the only human's login.
 *   STORABLE         a wrangler secret, a GitHub Actions secret, a local file.
 *                    A Better Auth session cookie is none of those: it expires,
 *                    it lives in the production KV namespace, and it cannot be
 *                    minted by a machine at all.
 *
 * Storage and lifecycle are the OPERATOR TOKEN's, deliberately and exactly:
 * `wrangler secret put SMOKE_TOKEN` for the Worker, `SMOKE_TOKEN_FILE` pointing
 * at a local file for a machine that runs the gate, `gh secret set SMOKE_TOKEN`
 * for CI. Never on a command line, never in a log, never in an error body.
 *
 * ## THE RESIDUE IS ON THE ACTOR, WHERE THE ACTOR IS DEFINED
 *
 * What a read still exposes is stated on the `smoke` row of `WRITE_CAPABILITIES`
 * in `app/lib/editor/publish-policy.mjs`, because that is where the kind is
 * defined and a residue filed anywhere else is a residue nobody meets. Short
 * form: the claim this credential supports is BOUNDED, not SAFE.
 */

import { constantTimeEqual, tokenLabel } from "~/lib/bearer.server";

/**
 * ITS OWN RATE-LIMIT KEY PREFIX on the existing Durable Object, joining `ip:`,
 * `auth:`, `op:`, `preview:` and `csp:`.
 *
 * Its own, not the operator's, so the two cannot exhaust each other: a CI sweep
 * running flat out must never be able to lock the publish path out, and a
 * runaway agent must never be able to make the browser gate report a layout
 * failure that is really a 429.
 *
 * **THE CEILING IS DELIBERATELY HIGH, and the reason is what the limit is FOR.**
 * This is not a per-visitor throttle on a billed path. Nothing behind it spends
 * money: every request it admits is a D1 read the admin plane already does. Its
 * job is to bound the read volume a LEAKED token could draw before anyone
 * notices, and to stop an infinite loop in a harness. A legitimate sweep is a
 * burst of tens of document loads inside a few seconds, which is exactly the
 * traffic shape a tight limit would refuse, so a tight limit here would buy
 * nothing and break the one caller.
 */
export const SMOKE_RATE_LIMIT = 240;
export const SMOKE_RATE_PERIOD_SECONDS = 60;

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
   * THE EMAIL IS RESOLVED HERE, INSIDE THE BOUNDARY, and that placement is a
   * gate's finding rather than a preference.
   *
   * The middleware read `env.ADMIN_EMAIL` directly to build the actor, and
   * `check:secrets` refused it by name: `admin.tsx` is a ROUTE, and hard rule 3
   * is a PATH rule, so a route reading a ratified secret is a violation whether
   * or not the value ever leaves the server. The alternative on offer was an
   * allowlist entry, which that gate's own header calls the wrong move.
   *
   * Resolving it here is also the more honest shape: the session path already
   * resolves the admin's address inside `auth.server.ts`, so both kinds of
   * caller now learn who they render as from a `.server` module, and neither
   * route touches the secret.
   *
   * Empty string when unset, matching `getAdminSession`'s own treatment of an
   * unconfigured ADMIN_EMAIL. Not a substituted placeholder: an empty topbar
   * label is visibly wrong, where an invented one would quietly move the
   * layout measurement this credential exists to take.
   */
  return { kind: "ok", id, email: env.ADMIN_EMAIL ?? "" };
}
