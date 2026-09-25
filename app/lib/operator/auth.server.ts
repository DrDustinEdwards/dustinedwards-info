// The token is the whole boundary: compared in constant time, and never echoed, logged or put in an error.

import { constantTimeEqual, tokenLabel } from "~/lib/bearer.server";

const OPERATOR_RATE_LIMIT = 30;
const OPERATOR_RATE_PERIOD_SECONDS = 60;

const MIN_TOKEN_LENGTH = 32;

export type OperatorEnv = Env & { OPERATOR_TOKEN?: string };

type AuthResult =
  | { ok: true; id: string }
  | { ok: false; status: number; error: string; retryAfter?: number };

// Authenticate FIRST: the limiter is keyed to a proven identity, so an anonymous flood cannot spend a
// real operator's budget or reach a Durable Object.
export async function authenticateOperator(
  env: OperatorEnv,
  request: Request,
): Promise<AuthResult> {
  const configured = env.OPERATOR_TOKEN;

  // No secret set means the path is closed, not open to everyone.
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

  // Refused on length BEFORE the hash: `constantTimeEqual` hashes both operands, which an anonymous caller
  // could otherwise request in any size. Twice the length, not equal, so it is not a length oracle.
  if (presented.length > configured.length * 2) {
    return { ok: false, status: 401, error: "Invalid or missing bearer token." };
  }

  // Still compared when absent, so a missing header and a wrong token take the same path and time.
  const valid = await constantTimeEqual(presented, configured);
  if (!valid) {
    return { ok: false, status: 401, error: "Invalid or missing bearer token." };
  }

  const id = tokenLabel(presented);

  return { ok: true, id };
}

// Separate from authentication so reading the describe call does not spend publish budget.
export async function meterOperator(
  env: OperatorEnv,
  id: string,
): Promise<AuthResult> {
  if (!env.ASK_BUDGET) {
    // A privileged endpoint without its limiter does not serve unprotected; it does not serve.
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

