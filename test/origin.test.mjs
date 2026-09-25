/* The threat is BUDGET, not identity: a hostile page can make its own readers' browsers spend
 * Ask, and a per-IP limiter is blind to that because a thousand readers are a thousand IPs. */

import test from "node:test";
import assert from "node:assert/strict";

import { ASK_ORIGIN_REFUSAL, originVerdict } from "../app/lib/origin.mjs";

const URL_HTTPS = "https://dustinedwards.dustin-edwards.workers.dev/search/ask";

test("SAME ORIGIN IS ACCEPTED", () => {
  const v = originVerdict("https://dustinedwards.dustin-edwards.workers.dev", URL_HTTPS);
  assert.equal(v.ok, true);
  assert.equal(v.reason, "same-origin");
});

test("CROSS ORIGIN IS REFUSED, which is the whole point", () => {
  for (const origin of [
    "https://evil.com",
    // A SUFFIX ATTACK. Whole origins are compared, not endsWith, because a prefix or suffix
    // test is how "...workers.dev.evil.com" gets in.
    "https://dustinedwards.dustin-edwards.workers.dev.evil.com",
    "https://sub.dustinedwards.dustin-edwards.workers.dev",
  ]) {
    const v = originVerdict(origin, URL_HTTPS);
    assert.equal(v.ok, false, `${origin} must be refused`);
    assert.equal(v.reason, "cross-origin");
  }
});

test("ABSENT Origin IS ACCEPTED, deliberately", () => {
  for (const absent of [null, undefined, ""]) {
    const v = originVerdict(absent, URL_HTTPS);
    assert.equal(v.ok, true, `${String(absent)} must be accepted`);
    assert.equal(v.reason, "absent");
  }
});

test("THE STRING \"null\" IS REFUSED, and it is NOT the absent case", () => {
  // A sandboxed iframe and some cross-origin redirects send a literal "null".
  // That is a real browser request from an opaque origin, which is the shape a
  // hostile page uses. One character apart from the absent case, opposite answer.
  const opaque = originVerdict("null", URL_HTTPS);
  assert.equal(opaque.ok, false, "an opaque origin is not a missing origin");
  assert.equal(opaque.reason, "cross-origin");
  assert.equal(originVerdict(null, URL_HTTPS).ok, true, "and JS null still passes");
});

test("SCHEME IS PART OF THE ORIGIN: http is not https", () => {
  assert.equal(
    originVerdict("http://dustinedwards.dustin-edwards.workers.dev", URL_HTTPS).ok,
    false,
  );
});

test("PORT IS PART OF THE ORIGIN, so a dev server is not the site", () => {
  assert.equal(originVerdict("http://localhost:5173", "http://localhost:5173/search/ask").ok, true);
  assert.equal(originVerdict("http://localhost:5174", "http://localhost:5173/search/ask").ok, false);
});

test("IT COMPARES AGAINST THE REQUEST'S OWN ORIGIN, not a pinned constant", () => {
  // The site answers on workers.dev and on the apex after cutover, so a comparison pinned to
  // one constant would refuse every real request from the other host.
  const apex = "https://dustinedwards.info/search/ask";
  assert.equal(originVerdict("https://dustinedwards.info", apex).ok, true);
  assert.equal(
    originVerdict("https://dustinedwards.dustin-edwards.workers.dev", apex).ok,
    false,
    "a stale host is cross-origin to the one actually serving",
  );
});

test("AN UNPARSEABLE REQUEST URL FAILS CLOSED", () => {
  const v = originVerdict("https://evil.com", "not a url");
  assert.equal(v.ok, false);
  assert.equal(v.reason, "unparseable-request-url");
});

test("the refusal text names no internals", () => {
  assert.doesNotMatch(ASK_ORIGIN_REFUSAL, /budget|AI|corpus|rate|token/i);
});
