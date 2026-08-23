/**
 * The `/api/auth/*` rate limit: its numbers and its refusal.
 *
 * REPLAYS THE FINDING, per hard rule 12. The 2026-08-22 audit, section 3: "No
 * rate limit on `/api/auth/*`. The Ask endpoint has a Durable Object limiter;
 * the auth callback has none." That was verified TRUE against the code on
 * 2026-08-23, which makes this one of the two claims in that batch that
 * survived checking.
 *
 * What is asserted here is the half a unit test can see: that the limit is
 * above a full sign-in flow so it cannot lock the only admin out, that it is
 * far below unbounded, and that the refusal is a 429 carrying `Retry-After`
 * and no oracle.
 *
 * WHAT THIS CANNOT SEE, stated because a passing file here is not a guarded
 * endpoint: whether the route actually CALLS the guard, and whether the
 * Durable Object counts correctly. The first is source, the second needs a
 * binding. Neither is reachable from `node --test`.
 *
 * @see app/lib/auth-rate.mjs
 * @see app/routes/api.auth.$.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  AUTH_RATE_LIMIT,
  AUTH_RATE_PERIOD_SECONDS,
  authRateRefusal,
} from "../app/lib/auth-rate.mjs";

/** A complete Better Auth Google flow over HTTP, measured by reading the route. */
const REQUESTS_PER_SIGN_IN = 3;

test("the limit clears a full sign-in with room for retries", () => {
  // The failure this guards against is not an attacker getting through, it is
  // the only person who can reach /admin being locked out of it by fumbling.
  assert.ok(
    AUTH_RATE_LIMIT >= REQUESTS_PER_SIGN_IN * 5,
    `${AUTH_RATE_LIMIT} leaves fewer than five sign-in attempts in the window`,
  );
});

test("the limit is still tight in absolute terms", () => {
  // One person, a few times a month. Anything near a hundred is not a limit.
  assert.ok(AUTH_RATE_LIMIT <= 30, `${AUTH_RATE_LIMIT} is too loose to cap anything`);
});

test("the window is long enough to span a retried sign-in", () => {
  assert.ok(
    AUTH_RATE_PERIOD_SECONDS >= 300,
    `${AUTH_RATE_PERIOD_SECONDS}s is short enough that a slow OAuth round trip ` +
      `could straddle two windows and read as two separate bursts`,
  );
});

test("the refusal is a 429 carrying Retry-After", () => {
  const res = authRateRefusal();
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("retry-after"), String(AUTH_RATE_PERIOD_SECONDS));
});

test("the refusal is not cached, because a cached 429 keeps refusing", () => {
  // Workers Cache sits in front of this Worker and a response with no
  // Cache-Control is heuristically CACHED, not skipped. Hard rule 8.
  const cc = authRateRefusal().headers.get("cache-control") ?? "";
  assert.match(cc, /no-store/);
  assert.match(cc, /private/);
});

test("the refusal is not an oracle", async () => {
  // An auth endpoint's error messages answer questions nobody asked. This one
  // must not say whether the address was the admin's, whether a session
  // existed, or which step was reached.
  const body = await authRateRefusal().text();
  for (const leak of ["admin", "email", "session", "google", "callback", "token"]) {
    assert.ok(
      !body.toLowerCase().includes(leak),
      `the refusal body mentions ${JSON.stringify(leak)}: ${body}`,
    );
  }
});

test("a caller-supplied Retry-After is honoured", () => {
  assert.equal(authRateRefusal(42).headers.get("retry-after"), "42");
});
