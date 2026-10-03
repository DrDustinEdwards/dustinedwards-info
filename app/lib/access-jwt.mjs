/**
 * Verifies the signed token Cloudflare Access attaches to a request it let through. Pure: the keys,
 * issuer, audience and clock are arguments, so a test can mint its own.
 *
 * Presence of the `Cf-Access-Jwt-Assertion` header proves nothing, since anyone can send one. What
 * proves a request passed Access is a signature by a key Access publishes, an `aud` equal to THIS
 * application's tag and an `iss` equal to this team's domain.
 */

/** Seconds a token may be early or late against this Worker's clock. */
const CLOCK_SKEW_SECONDS = 60;

/** @param {string} text base64url */
function base64UrlBytes(text) {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/** @param {string} text base64url JSON */
function base64UrlJson(text) {
  return JSON.parse(new TextDecoder().decode(base64UrlBytes(text)));
}

/**
 * @param {string} token the compact JWT
 * @param {{ keys: { kid: string, kty: string, n: string, e: string }[] }} jwks
 * @param {{ issuer: string, audience: string, now: number }} expected `now` in epoch seconds
 * @returns {Promise<{ ok: true, claims: Record<string, unknown> } | { ok: false, reason: string }>}
 */
export async function verifyAccessJwt(token, jwks, { issuer, audience, now }) {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => part === "")) return { ok: false, reason: "malformed" };
  const [head = "", body = "", signature = ""] = parts;

  let header;
  let claims;
  try {
    header = base64UrlJson(head);
    claims = base64UrlJson(body);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  // Pinned, never read from the token: `alg: none` and HMAC-with-the-public-key are the classic forgeries.
  if (header.alg !== "RS256") return { ok: false, reason: "algorithm" };
  const jwk = jwks.keys.find((key) => key.kid === header.kid && key.kty === "RSA");
  if (!jwk) return { ok: false, reason: "unknown-key" };

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlBytes(signature),
    new TextEncoder().encode(`${head}.${body}`),
  );
  if (!valid) return { ok: false, reason: "signature" };

  if (claims.iss !== issuer) return { ok: false, reason: "issuer" };
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(audience)) return { ok: false, reason: "audience" };
  if (typeof claims.exp !== "number" || claims.exp + CLOCK_SKEW_SECONDS < now) {
    return { ok: false, reason: "expired" };
  }
  if (typeof claims.nbf === "number" && claims.nbf - CLOCK_SKEW_SECONDS > now) {
    return { ok: false, reason: "not-yet-valid" };
  }
  return { ok: true, claims };
}
