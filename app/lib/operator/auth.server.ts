/**
 * Authentication for the operator publish path.
 *
 * A static bearer token, held as a wrangler secret. Not Better Auth: that plane
 * is a Google login with a browser session in KV, and an agent has no browser.
 * Not OAuth either, because there is one caller class and one owner, and an
 * authorization-code dance with nobody to click "allow" is theatre.
 *
 * The token is the whole boundary, so it is compared in constant time and it is
 * never echoed, logged, or included in an error.
 *
 * The comparison and the caller label moved to `~/lib/bearer.server` on
 * 2026-08-24 when the SMOKE credential became the second static bearer here.
 * Both bodies went across verbatim; see that file for why a second copy of a
 * constant-time compare is the expensive kind of duplication.
 */

import { constantTimeEqual, tokenLabel } from "~/lib/bearer.server";

export const OPERATOR_RATE_LIMIT = 30;
export const OPERATOR_RATE_PERIOD_SECONDS = 60;

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
   * REFUSED BEFORE THE HASH, on length alone, above twice the real token.
   *
   * `constantTimeEqual` hashes BOTH operands so that comparison time does not
   * depend on where they diverge. That is the right shape and it has one cost:
   * the input side is whatever the caller sent, so hashing it is work an
   * unauthenticated caller can ask for in any quantity. A megabyte of bearer
   * token is a megabyte of SHA-256 per request, before anything has checked
   * who is asking.
   *
   * TWICE, NOT EQUAL, deliberately. An exact-length gate would turn this into
   * an oracle for the token's length, one request at a time. At twice the
   * length the only thing a caller learns is that the real token is shorter
   * than half of what they sent, which no attack needs, and everything past
   * that bound is refused for free.
   *
   * The constant-time property is UNCHANGED for every candidate that could
   * possibly be right: anything inside the bound still goes through the same
   * hash-and-compare, so a missing header and a wrong token of plausible
   * length still take the same path and the same time.
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
 * ## SPLIT OUT OF `authenticateOperator` on 2026-08-28
 *
 * Metering ran unconditionally inside authentication, so every request that
 * proved who it was also spent budget, including `GET /api/operator`, which is
 * the DESCRIBE call: it takes no arguments, changes nothing, and exists so a
 * client can discover the surface. A client that reads the description before
 * each publish therefore halved its own publish allowance, and a client that
 * polled the description could exhaust it without ever writing anything.
 *
 * The two questions are separate and now the code says so: "who is this" is
 * cheap and always asked, "may they spend one" is a Durable Object call and is
 * asked only where something is spent.
 *
 * THE ORDER IS UNCHANGED where both run. Authenticate first, then meter, so
 * the limiter is keyed to a proven identity and an unauthenticated flood
 * cannot exhaust a real operator's budget or reach a Durable Object at all.
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

