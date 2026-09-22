/**
 * Authentication for the operator publish path.
 *
 * A static bearer token, held as a wrangler secret. Not Better Auth, whose plane is a Google login
 * with a browser session in KV and an agent has no browser; not OAuth, because there is one caller
 * class and one owner, and an authorization-code dance with nobody to click "allow" is theater.
 *
 * The token is the whole boundary, so it is compared in constant time and it is never echoed, logged
 * or included in an error. The comparison and the caller label live in `~/lib/bearer.server`.
 */

import { constantTimeEqual, tokenLabel } from "~/lib/bearer.server";

const OPERATOR_RATE_LIMIT = 30;
const OPERATOR_RATE_PERIOD_SECONDS = 60;

/** Minimum token length. A short secret here is a misconfiguration, not a choice. */
const MIN_TOKEN_LENGTH = 32;

export type OperatorEnv = Env & { OPERATOR_TOKEN?: string };

export type AuthResult =
  | { ok: true; id: string }
  | { ok: false; status: number; error: string; retryAfter?: number };

/**
 * Authenticates a request and consumes one unit of its rate budget.
 *
 * Order is deliberate: authenticate FIRST, then rate limit. The limiter is
 * keyed to the operator identity, so an unauthenticated flood cannot exhaust a
 * real operator's budget, and an anonymous caller is refused before it can
 * reach a Durable Object at all.
 */
export async function authenticateOperator(
  env: OperatorEnv,
  request: Request,
): Promise<AuthResult> {
  const configured = env.OPERATOR_TOKEN;

  // No secret set means the path is not open, not that it is open to everyone.
  if (!configured || configured.length < MIN_TOKEN_LENGTH) {
    return {
      ok: false,
      status: 503,
      error:
        "The operator publish path is not configured on this deployment. " +
        "Set the OPERATOR_TOKEN wrangler secret to enable it.",
    };
  }

  const header = request.headers.get("authorization") ?? "";
  const presented = /^Bearer\s+(.+)$/i.exec(header.trim())?.[1] ?? "";

  /*
   * REFUSED BEFORE THE HASH, on length alone, above twice the real token. `constantTimeEqual` hashes
   * BOTH operands, so hashing the input is work an unauthenticated caller can ask for in any quantity,
   * before anything has checked who is asking.
   *
   * TWICE, NOT EQUAL, deliberately: an exact-length gate would be an oracle for the token's length, one
   * request at a time.
   *
   * The constant-time property is UNCHANGED for every candidate that could possibly be right, since
   * anything inside the bound still goes through the same hash-and-compare.
   */
  if (presented.length > configured.length * 2) {
    return { ok: false, status: 401, error: "Invalid or missing bearer token." };
  }

  // Still compared when absent, so a missing header and a wrong token take the
  // same path and the same time.
  const valid = await constantTimeEqual(presented, configured);
  if (!valid) {
    return { ok: false, status: 401, error: "Invalid or missing bearer token." };
  }

  const id = tokenLabel(presented);

  return { ok: true, id };
}

/**
 * Spends one unit of the caller's rate limit.
 *
 * SEPARATE FROM `authenticateOperator`, because the two questions are: "who is this" is cheap and
 * always asked, "may they spend one" is a Durable Object call asked only where something is spent.
 * Metering inside authentication meant the DESCRIBE call spent budget, halving a client's publish
 * allowance if it read the description first.
 *
 * THE ORDER IS UNCHANGED where both run: authenticate, then meter, so the limiter is keyed to a proven
 * identity and an unauthenticated flood cannot reach a Durable Object at all.
 *
 * @param env @param id the authenticated operator label
 */
export async function meterOperator(
  env: OperatorEnv,
  id: string,
): Promise<AuthResult> {
  if (!env.ASK_BUDGET) {
    // The same stance the Ask guards take: a metered or privileged endpoint
    // without its limiter does not serve unprotected, it does not serve.
    return {
      ok: false,
      status: 503,
      error: "Rate limiting is unavailable, so the operator path is disabled.",
    };
  }

  const limiter = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName(`op:${id}`));
  const { ok } = await limiter.hit(OPERATOR_RATE_LIMIT, OPERATOR_RATE_PERIOD_SECONDS);
  if (!ok) {
    return {
      ok: false,
      status: 429,
      error: `Rate limit: ${OPERATOR_RATE_LIMIT} requests per ${OPERATOR_RATE_PERIOD_SECONDS} seconds.`,
      retryAfter: OPERATOR_RATE_PERIOD_SECONDS,
    };
  }

  return { ok: true, id };
}

