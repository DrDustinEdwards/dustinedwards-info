import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFERRED_CHECKS,
  deferredMisses,
  readinessVerdict,
} from "../scripts/lib/readiness.mjs";
import { healthChecks } from "../app/lib/health/rows.mjs";
import { bodyDrifted, HEALTHY as HEALTHY_BODY } from "./lib/health-bodies.mjs";

const HEALTHY = JSON.stringify(HEALTHY_BODY);

const UNHEALTHY = JSON.stringify(bodyDrifted({ "ask-index-drift": { expected: 99, present: 90 } }));

await test("a healthy report passes and carries its checks", () => {
  const verdict = readinessVerdict(200, HEALTHY);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.checks.length, HEALTHY_BODY.checks.length);
});

await test("THE PLANT: a 200 whose drift check warns refuses, naming the check", () => {
  // 200 is the plant and what /health really sends on a warn: the status alone would pass.
  for (const status of [200, 503]) {
    const verdict = readinessVerdict(status, UNHEALTHY);
    assert.equal(verdict.ok, false, `HTTP ${status}`);
    assert.match(verdict.why, /not healthy/);
    assert.match(verdict.why, /ask-index-drift/);
    assert.match(verdict.remedy, /NOTHING WAS SYNCED/);
  }
});

await test("THE PLANT, second form: a 200 carrying status pass but no checks still refuses", () => {
  // Any JSON document on this origin can carry a status; only a health report carries a
  // checks array, so this is what stops the step passing against the wrong URL.
  const verdict = readinessVerdict(200, JSON.stringify({ status: "pass", ok: true }));
  assert.equal(verdict.ok, false);
  assert.match(verdict.why, /no checks in its body/);
});

await test("a real non-health JSON document on this origin refuses", () => {
  const feed = JSON.stringify({
    version: "https://jsonfeed.org/version/1.1",
    title: "Dustin Edwards blog",
    items: [{ id: "x", title: "y" }],
  });
  const verdict = readinessVerdict(200, feed);
  assert.equal(verdict.ok, false);
  assert.match(verdict.why, /no checks in its body/);
});

await test("429 is told apart from unhealthy, because the repairs differ", () => {
  const verdict = readinessVerdict(429, JSON.stringify({ status: "fail", checks: [{ name: "rate-limited", status: "fail" }] }));
  assert.equal(verdict.ok, false);
  assert.match(verdict.why, /rate limited/);
  assert.match(verdict.remedy, /the limiter working, not the site failing/);
  assert.doesNotMatch(verdict.why, /not healthy/);
});

await test("an unparseable body refuses rather than being treated as absent", () => {
  const verdict = readinessVerdict(200, "<!DOCTYPE html><html>a 404 page</html>");
  assert.equal(verdict.ok, false);
  assert.match(verdict.why, /not JSON/);
});

await test("JSON that is not an object refuses", () => {
  for (const body of ["null", "[]", '"ok"', "42", "true"]) {
    const verdict = readinessVerdict(200, body);
    assert.equal(verdict.ok, false, `for ${body}`);
  }
});

await test("the body's status is required to be exactly pass, not merely truthy", () => {
  const verdict = readinessVerdict(200, JSON.stringify({ status: "yes", checks: [{ name: "a", status: "pass" }] }));
  assert.equal(verdict.ok, false);
});

// A drifted corpus must not block its own repair: the D1 sync that converges
// content-drift runs after readiness.
const DRIFTED_CORPUS = JSON.stringify(
  bodyDrifted({ "content-drift": { expected: 16, present: 14 } }),
);

await test("THE PLANT: a corpus missing a post from D1 ships, and does not refuse", () => {
  const gated = readinessVerdict(503, DRIFTED_CORPUS);
  assert.equal(gated.ok, false, "undeferred, this is still a refusal");
  assert.match(gated.why, /content-drift/);

  const deferred = readinessVerdict(503, DRIFTED_CORPUS, "/health", ["content-drift"]);
  assert.equal(deferred.ok, true, "a drifted corpus reaches the sync that repairs it");
  assert.deepEqual(
    deferred.deferredFailing,
    ["content-drift"],
    "and it is reported as failing, never silently forgiven",
  );
  assert.equal(deferred.checks.length, HEALTHY_BODY.checks.length, "every check is still carried for the table");
});

await test("deferring content-drift does not defer anything else", () => {
  const alsoAsk = JSON.stringify({
    status: "warn",
    checks: [
      { name: "ask-index-drift", status: "warn", detail: "90 of 99" },
      { name: "content-drift", status: "warn", detail: "14 of 16" },
      { name: "fts-equality", status: "pass" },
    ],
  });

  const verdict = readinessVerdict(503, alsoAsk, "/health", ["content-drift"]);
  assert.equal(verdict.ok, false, "a real failure still refuses");
  assert.match(verdict.why, /ask-index-drift/, "and it is named");
  assert.doesNotMatch(verdict.why, /content-drift/, "the deferred one is not the reason");
});

await test("an endpoint disagreeing with itself still refuses, even with a deferral", () => {
  // warn while every check passes. Nothing to subtract, so nothing excuses it.
  const incoherent = JSON.stringify({
    status: "warn",
    checks: [
      { name: "content-drift", status: "pass" },
      { name: "fts-equality", status: "pass" },
    ],
  });

  const verdict = readinessVerdict(503, incoherent, "/health", ["content-drift"]);
  assert.equal(verdict.ok, false);
  assert.match(verdict.why, /no check is marked failing/);
});

// The Ask converge that repairs ask-index-drift runs AFTER readiness, so readiness must
// defer it and the post-repair assertion must then name it.
const ASK_DRIFTED = JSON.stringify(
  bodyDrifted({ "ask-index-drift": { expected: 121, present: 120 } }),
);

await test("THE PLANT: ask-index-drift reaches the converge that repairs it", () => {
  const gated = readinessVerdict(503, ASK_DRIFTED);
  assert.equal(gated.ok, false, "undeferred, this still refuses");
  assert.match(gated.why, /ask-index-drift/);

  const deferred = readinessVerdict(503, ASK_DRIFTED, "/health", Object.keys(DEFERRED_CHECKS));
  assert.equal(deferred.ok, true, "deferred, the ship reaches the Ask converge");
  assert.deepEqual(
    deferred.deferredFailing,
    ["ask-index-drift"],
    "reported as failing, never silently forgiven",
  );
});

await test("THE OTHER HALF: the same body fails the post-repair assertion, by name", () => {
  const { misses, converged } = deferredMisses(healthChecks(JSON.parse(ASK_DRIFTED)), DEFERRED_CHECKS);
  assert.equal(misses.length, 1, "one deferred check is still failing");
  assert.match(misses[0], /ask-index-drift is STILL failing after the Ask converge/);
  assert.match(misses[0], /expected 121, present 120/, "the counts the wire carries are the triage");
  assert.deepEqual(
    converged.sort(),
    [
      "content-drift",
      "cv-drift",
      "cv-pdf-drift",
      "dictionary-drift",
      "llms-drift",
      "media-index-drift",
      "pages-drift",
      "phage-drift",
      "procedures-drift",
      "publications-drift",
      "registry-drift",
      "roster-drift",
    ],
    "the twelve that did converge are reported converged, not silent",
  );
});

await test("a deferred check the endpoint stopped reporting is a MISS, not a pass", () => {
  const { misses } = deferredMisses(healthChecks({ checks: [{ name: "content-drift", status: "pass" }] }), DEFERRED_CHECKS);
  const absent = Object.keys(DEFERRED_CHECKS).filter((name) => name !== "content-drift");
  assert.ok(absent.length > 0, "the case needs at least one deferred check left unreported");
  assert.equal(misses.length, absent.length, "every absent check is named");
  for (const name of absent) {
    assert.match(misses.join(" "), new RegExp(`no ${name} check, so nothing was proven`));
  }
});

await test("every deferred check converging leaves no miss", () => {
  const healthy = healthChecks(JSON.parse(HEALTHY));
  const { misses, converged } = deferredMisses(healthy, DEFERRED_CHECKS);
  assert.deepEqual(misses, [], "a clean run reports nothing");
  assert.deepEqual(
    converged.sort(),
    Object.keys(DEFERRED_CHECKS).sort(),
    "and says so for every one rather than staying quiet",
  );
});

await test("a check whose status is not exactly pass is a failure, not a pass", () => {
  for (const status of ["PASS", "ok", 1, null, undefined]) {
    const body = JSON.stringify({ status: "pass", checks: [{ name: "fts-equality", status }] });
    const verdict = readinessVerdict(200, body);
    assert.equal(verdict.ok, false, `status: ${JSON.stringify(status)} must not pass`);
  }
});

await test("a stale nightly dump is printed and does not hold back a ship", () => {
  const body = JSON.stringify({
    status: "warn",
    checks: [
      { name: "db", status: "pass" },
      { name: "backup", status: "warn", detail: "newest complete dump is 30 hours old" },
    ],
  });
  const verdict = readinessVerdict(200, body);
  assert.equal(verdict.ok, true);
});
