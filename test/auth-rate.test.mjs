import test from "node:test";
import assert from "node:assert/strict";

import { AUTH_RATE_PERIOD_SECONDS, authRateRefusal } from "../app/lib/auth-rate.mjs";

test("the refusal is a 429 carrying Retry-After", () => {
  const res = authRateRefusal();
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("retry-after"), String(AUTH_RATE_PERIOD_SECONDS));
});

test("the refusal is not cached, because a cached 429 keeps refusing", () => {
  // Workers Cache sits in front of this Worker and a response with no
  // Cache-Control is heuristically CACHED, not skipped.
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

test("a caller-supplied Retry-After is honored", () => {
  assert.equal(authRateRefusal(42).headers.get("retry-after"), "42");
});
