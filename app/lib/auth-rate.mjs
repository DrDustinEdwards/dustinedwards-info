// What this caps is the outbound Google token exchange every callback hit
// triggers before `signIn.before` can reject a non-admin: unbounded, it is an
// amplifier aimed at Google using our OAuth client.

/**
 * About three requests per Google sign-in flow, so twenty is six flows. Tighter
 * risks locking the only admin out after a fumbled sign-in. Not a security
 * boundary: `ADMIN_EMAIL` in `signIn.before` is.
 */
export const AUTH_RATE_LIMIT = 20;

export const AUTH_RATE_PERIOD_SECONDS = 600;

/**
 * No detail in the body: an auth endpoint's error messages are an oracle.
 * `private, no-store` is explicit because Workers Cache caches a response with
 * no `Cache-Control`, and a cached 429 would keep refusing a recovered caller.
 *
 * @param {number} [retryAfter] seconds, defaults to the window
 * @returns {Response}
 */
export function authRateRefusal(retryAfter = AUTH_RATE_PERIOD_SECONDS) {
  return new Response(JSON.stringify({ error: "Too many requests." }), {
    status: 429,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "retry-after": String(retryAfter),
      "cache-control": "private, no-store",
    },
  });
}
