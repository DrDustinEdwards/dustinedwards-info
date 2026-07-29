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
 */

export const OPERATOR_RATE_LIMIT = 30;
export const OPERATOR_RATE_PERIOD_SECONDS = 60;

/** Minimum token length. A short secret here is a misconfiguration, not a choice. */
const MIN_TOKEN_LENGTH = 32;

export type OperatorEnv = Env & { OPERATOR_TOKEN?: string };

export type AuthResult =
  | { ok: true; id: string }
  | { ok: false; status: number; error: string; retryAfter?: number };

/**
 * Compares two strings without leaking where they diverge.
 *
 * A plain `===` on a secret returns as soon as two bytes differ, so the time it
 * takes is a function of how much of the prefix the caller guessed correctly,
 * and that is enough to recover a token a byte at a time over enough requests.
 *
 * Both sides are hashed to a fixed 32 bytes FIRST, then compared. Comparing the
 * raw strings would still leak their LENGTH through the loop bound, and hashing
 * makes both operands the same size whatever was sent.
 */
async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);

  let diff = 0;
  for (let i = 0; i < va.length; i += 1) diff |= va[i] ^ vb[i];
  return diff === 0;
}

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

  // Still compared when absent, so a missing header and a wrong token take the
  // same path and the same time.
  const valid = await constantTimeEqual(presented, configured);
  if (!valid) {
    return { ok: false, status: 401, error: "Invalid or missing bearer token." };
  }

  const id = operatorId(presented);

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

/**
 * A short, stable, non-reversing label for the token holder.
 *
 * It goes into commit messages, so it must identify the caller without being
 * the secret. Eight hex characters of a hash of the token: stable across
 * requests, changes if the token is rotated, and reveals nothing.
 *
 * Synchronous FNV-1a rather than SHA-256, because this runs after the token has
 * already been verified and is a label rather than a boundary.
 */
function operatorId(token: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
