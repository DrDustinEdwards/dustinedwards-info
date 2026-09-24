/**
 * The rate limit on `/api/auth/*`, and the refusal it produces.
 *
 * Pure on purpose: `check:tests` runs `node --test` over modules like this one
 * and cannot reach anything that touches a binding, so the numbers and the
 * response shape live here and only the Durable Object call lives next door in
 * `auth-rate.server.ts`.
 *
 * ## WHY THIS EXISTS
 *
 * The 2026-08-22 audit, section 3: "No rate limit on `/api/auth/*`. The Ask
 * endpoint has a Durable Object limiter; the auth callback has none. Google's
 * own throttling is the only backstop." Verified true against the code on
 * 2026-08-23: `app/routes/api.auth.$.ts` handed every request straight to
 * Better Auth with nothing in front of it.
 *
 * The cost being capped is not a password guess, because there are no passwords
 * here. It is the OUTBOUND CALL: every hit on the Google callback makes this
 * Worker perform a token exchange against Google's servers before Better Auth
 * can reject a non-admin email in `signIn.before`. Unbounded, that is an
 * amplifier pointed at a third party using our credentials, and the first thing
 * anyone would notice is the OAuth client being throttled or suspended.
 */

/**
 * Requests per window, per IP.
 *
 * ## THE BASIS, since a number without one is a guess
 *
 * DEMAND: one person signs in a few times a month. A complete Better Auth
 * Google flow over HTTP is about three requests (`sign-in/social`, the
 * `callback/google` redirect, and a session read), so twenty is roughly six
 * full sign-ins inside the window.
 *
 * WHY NOT TIGHTER, which the brief invited: a limit that a fumbled sign-in can
 * trip locks the only person who can reach the admin plane out of the only door
 * into it, and the recovery is waiting. Six flows of headroom costs nothing and
 * removes that failure mode.
 *
 * WHY NOT LOOSER: this caps induced Google token exchanges at 120 per hour per
 * IP instead of unbounded, which is the whole point.
 *
 * NOT a security boundary on its own. `ADMIN_EMAIL` checked in `signIn.before`
 * is what stops a non-admin creating a session, and it is unaffected by how
 * many requests arrive. This bounds the COST of being hammered, nothing else.
 */
export const AUTH_RATE_LIMIT = 20;

/** Ten minutes. Long enough to span a retried sign-in, short enough to forgive. */
export const AUTH_RATE_PERIOD_SECONDS = 600;

/**
 * The refusal. 429 with `Retry-After`, and deliberately no detail.
 *
 * The body says nothing about whether the address is the admin's, whether a
 * session exists, or which step was reached. An auth endpoint's error messages
 * are an oracle, and the one thing this must not do is answer questions it was
 * not asked while it is refusing to answer the one it was.
 *
 * `private, no-store` because a cached 429 would keep refusing a caller who is
 * no longer over the limit. Workers Cache sits in front of this Worker and
 * the cache-header rule is that a response with no `Cache-Control` is CACHED, not
 * skipped, so this is stated rather than inherited.
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
