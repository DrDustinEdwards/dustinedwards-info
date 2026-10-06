/**
 * Verifies the signed token Cloudflare Access attaches to a request it let through, with jose (the verifier carrel
 * already runs; Dustin ruled it the standard). Pure: the keys, issuer, audience and clock are arguments, so a test can
 * mint its own.
 *
 * Presence of the `Cf-Access-Jwt-Assertion` header proves nothing, since anyone can send one. What proves a request
 * passed Access is a signature by a key Access publishes, an `aud` equal to THIS application's tag and an `iss` equal
 * to this team's domain. The algorithm is pinned to RS256 here, never read from the token: `alg: none` and
 * HMAC-with-the-public-key are the classic forgeries.
 */

import { errors, jwtVerify } from "jose";

/** Seconds a token may be early or late against this Worker's clock. */
export const CLOCK_TOLERANCE_SECONDS = 60;

/** The reason a token is refused, by the code of the error jose raises for it. */
const REASON_BY_CODE = /** @type {const} */ ({
  [errors.JWTExpired.code]: "expired",
  [errors.JWSSignatureVerificationFailed.code]: "signature",
  [errors.JOSEAlgNotAllowed.code]: "algorithm",
  [errors.JWKSNoMatchingKey.code]: "unknown-key",
  [errors.JWKSMultipleMatchingKeys.code]: "unknown-key",
  [errors.JWSInvalid.code]: "malformed",
  [errors.JWTInvalid.code]: "malformed",
});

/** A claim that failed validation, by the claim's name. */
const REASON_BY_CLAIM = /** @type {Record<string, string>} */ ({ aud: "audience", iss: "issuer", exp: "expired", nbf: "not-yet-valid" });

/**
 * @param {string} token the compact JWT
 * @param {import("jose").JWTVerifyGetKey} getKey the team's signing keys (a remote or a local set)
 * @param {{ issuer: string, audience: string, now?: number }} expected `now` in epoch seconds, for a test's clock
 * @returns {Promise<{ ok: true, claims: Record<string, unknown> } | { ok: false, reason: string }>}
 */
export async function verifyAccessToken(token, getKey, { issuer, audience, now }) {
  try {
    const { payload } = await jwtVerify(token, getKey, {
      issuer,
      audience,
      algorithms: ["RS256"],
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      ...(now === undefined ? {} : { currentDate: new Date(now * 1000) }),
    });
    return { ok: true, claims: payload };
  } catch (error) {
    // Only a fault in the TOKEN is a refusal. A key set that cannot be fetched or is malformed is this Worker's problem and is
    // thrown, so an outage reads as an outage and not as every administrator being locked out silently.
    if (error instanceof errors.JWTClaimValidationFailed) return { ok: false, reason: REASON_BY_CLAIM[error.claim] ?? "claim" };
    const reason = error instanceof errors.JOSEError ? REASON_BY_CODE[error.code] : undefined;
    if (reason) return { ok: false, reason };
    throw error;
  }
}
