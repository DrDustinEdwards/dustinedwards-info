import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFERRED_CHECKS,
  deferredMisses,
  readinessVerdict,
} from "../scripts/lib/readiness.mjs";

const HEALTHY = JSON.stringify({
  ok: true,
  checks: [
    { name: "ask-index-drift", ok: true },
    { name: "media-index-drift", ok: true },
    { name: "media-backup-drift", ok: true },
    { name: "content-drift", ok: true },
    { name: "fts-equality", ok: true },
  ],
});

const UNHEALTHY = JSON.stringify({
  ok: false,
  checks: [
    { name: "ask-index-drift", ok: false, expected: 99, present: 90 },
    { name: "media-index-drift", ok: true },
    { name: "media-backup-drift", ok: true },
    { name: "content-drift", ok: true },
    { name: "fts-equality", ok: true },
  ],
});

test("a healthy report passes and carries its checks", () => {
  const verdict = readinessVerdict(200, HEALTHY);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.checks.length, 5);
});

test("THE PLANT: a 200 whose body does not say ok refuses, naming the check", () => {
  const verdict = readinessVerdict(503, UNHEALTHY);
  assert.equal(verdict.ok, false);
  assert.match(verdict.why, /not healthy/);
  assert.match(verdict.why, /ask-index-drift/);
  assert.match(verdict.remedy, /NOTHING WAS SYNCED/);
});

test("THE PLANT, second form: a 200 carrying ok:true but no checks still refuses", () => {
  // Any JSON document on this origin can carry ok:true; only a health report carries a
  // checks array, so this is what stops the step passing against the wrong URL.
  const verdict = readinessVerdict(200, JSON.stringify({ ok: true }));
  assert.equal(verdict.ok, false);
  assert.match(verdict.why, /no checks in its body/);
});

test("a real non-health JSON document on this origin refuses", () => {
  const feed = JSON.stringify({
    version: "https://jsonfeed.org/version/1.1",
    title: "Dustin Edwards blog",
    items: [{ id: "x", title: "y" }],
  });
  const verdict = readinessVerdict(200, feed);
  assert.equal(verdict.ok, false);
  assert.match(verdict.why, /no checks in its body/);
});

test("429 is told apart from unhealthy, because the repairs differ", () => {
  const verdict = readinessVerdict(429, JSON.stringify({ ok: false, checks: [{ name: "rate-limited", ok: false }] }));
  assert.equal(verdict.ok, false);
  assert.match(verdict.why, /rate limited/);
  assert.match(verdict.remedy, /the limiter working, not the site failing/);
  assert.doesNotMatch(verdict.why, /not healthy/);
});

test("an unparseable body refuses rather than being treated as absent", () => {
  const verdict = readinessVerdict(200, "<!DOCTYPE html><html>a 404 page</html>");
  assert.equal(verdict.ok, false);
  assert.match(verdict.why, /not JSON/);
});

test("JSON that is not an object refuses", () => {
  for (const body of ["null", "[]", '"ok"', "42", "true"]) {
    const verdict = readinessVerdict(200, body);
    assert.equal(verdict.ok, false, `for ${body}`);
  }
});

test("ok is required to be exactly true, not merely truthy", () => {
  const verdict = readinessVerdict(200, JSON.stringify({ ok: "yes", checks: [{ name: "a", ok: true }] }));
  assert.equal(verdict.ok, false);
});

test("THE DISCRIMINATING CONTROL: healthy and unhealthy do not agree", () => {
  const pass = readinessVerdict(200, HEALTHY);
  const fail = readinessVerdict(503, UNHEALTHY);
  assert.equal(pass.ok, true);
  assert.equal(fail.ok, false);
  assert.notEqual(pass.ok, fail.ok);
});

// A drifted corpus must not block its own repair: the D1 sync that converges
// content-drift runs after readiness.
const DRIFTED_CORPUS = JSON.stringify({
  ok: false,
  checks: [
    { name: "ask-index-drift", ok: true },
    { name: "media-index-drift", ok: true },
    { name: "media-backup-drift", ok: true },
    { name: "content-drift", ok: false, expected: 16, present: 14 },
    { name: "fts-equality", ok: true },
  ],
});

test("THE PLANT: a corpus missing a post from D1 ships, and does not refuse", () => {
  const gated = readinessVerdict(503, DRIFTED_CORPUS);
  assert.equal(gated.ok, false, "undeferred, this is still a refusal");
  assert.match(gated.why, /content-drift/);

  const deferred = readinessVerdict(503, DRIFTED_CORPUS, "/api/health", ["content-drift"]);
  assert.equal(deferred.ok, true, "a drifted corpus reaches the sync that repairs it");
  assert.deepEqual(
    deferred.deferredFailing,
    ["content-drift"],
    "and it is reported as failing, never silently forgiven",
  );
  assert.equal(deferred.checks.length, 5, "every check is still carried for the table");
});

test("deferring content-drift does not defer anything else", () => {
  const alsoAsk = JSON.stringify({
    ok: false,
    checks: [
      { name: "ask-index-drift", ok: false, expected: 99, present: 90 },
      { name: "content-drift", ok: false, expected: 16, present: 14 },
      { name: "fts-equality", ok: true },
    ],
  });

  const verdict = readinessVerdict(503, alsoAsk, "/api/health", ["content-drift"]);
  assert.equal(verdict.ok, false, "a real failure still refuses");
  assert.match(verdict.why, /ask-index-drift/, "and it is named");
  assert.doesNotMatch(verdict.why, /content-drift/, "the deferred one is not the reason");
});

test("an endpoint disagreeing with itself still refuses, even with a deferral", () => {
  // ok:false while every check says ok. Nothing to subtract, so nothing excuses it.
  const incoherent = JSON.stringify({
    ok: false,
    checks: [
      { name: "content-drift", ok: true },
      { name: "fts-equality", ok: true },
    ],
  });

  const verdict = readinessVerdict(503, incoherent, "/api/health", ["content-drift"]);
  assert.equal(verdict.ok, false);
  assert.match(verdict.why, /no check is marked failing/);
});

// The Ask converge that repairs ask-index-drift runs AFTER readiness, so readiness must
// defer it and the post-repair assertion must then name it.
const ASK_DRIFTED = JSON.stringify({
  ok: false,
  checks: [
    { name: "ask-index-drift", ok: false, expected: 121, present: 120 },
    { name: "media-index-drift", ok: true },
    { name: "media-backup-drift", ok: true },
    { name: "content-drift", ok: true },
    { name: "fts-equality", ok: true },
  ],
});

// Imported, not copied: a hand-written mirror would keep passing after a check was
// removed from ship's real list.
const SHIP_DEFERRED = DEFERRED_CHECKS;
test("THE PLANT: ask-index-drift reaches the converge that repairs it", () => {
  const gated = readinessVerdict(503, ASK_DRIFTED);
  assert.equal(gated.ok, false, "undeferred, this still refuses");
  assert.match(gated.why, /ask-index-drift/);

  const deferred = readinessVerdict(503, ASK_DRIFTED, "/api/health", Object.keys(SHIP_DEFERRED));
  assert.equal(deferred.ok, true, "deferred, the ship reaches the Ask converge");
  assert.deepEqual(
    deferred.deferredFailing,
    ["ask-index-drift"],
    "reported as failing, never silently forgiven",
  );
});

test("THE OTHER HALF: the same body fails the post-repair assertion, by name", () => {
  const { misses, converged } = deferredMisses(JSON.parse(ASK_DRIFTED).checks, SHIP_DEFERRED);
  assert.equal(misses.length, 1, "one deferred check is still failing");
  assert.match(misses[0], /ask-index-drift is STILL failing after the Ask converge/);
  assert.match(misses[0], /expected 121, present 120/, "the counts the wire carries are the triage");
  assert.deepEqual(
    converged.sort(),
    ["content-drift", "media-index-drift"],
    "the two that did converge are reported converged, not silent",
  );
});

test("a deferred check the endpoint stopped reporting is a MISS, not a pass", () => {
  const { misses } = deferredMisses([{ name: "content-drift", ok: true }], SHIP_DEFERRED);
  assert.equal(misses.length, 2, "the two absent checks are both named");
  assert.match(misses.join(" "), /no ask-index-drift check, so nothing was proven/);
  assert.match(misses.join(" "), /no media-index-drift check, so nothing was proven/);
});

test("every deferred check converging leaves no miss", () => {
  const healthy = JSON.parse(HEALTHY).checks;
  const { misses, converged } = deferredMisses(healthy, SHIP_DEFERRED);
  assert.deepEqual(misses, [], "a clean run reports nothing");
  assert.equal(converged.length, 3, "and says so for all three rather than staying quiet");
});
