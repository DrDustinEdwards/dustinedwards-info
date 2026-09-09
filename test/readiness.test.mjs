/**
 * Ship's readiness verdict.
 *
 * REPLAYS THE DEFECT, per hard rule 12. The defect is that ship proved a
 * deploy with five 200s from `/colophon` and never asked `/api/health`, so
 * every invariant the site actually watches could be broken while ship
 * reported success and went on to write D1. A drifted Ask index, a media index
 * that lost its rows, D1 out of step with the repository and an empty FTS
 * index beside a full content table all serve `/colophon` with a 200.
 *
 * THE PLANT THIS FILE MAKES PERMANENT is the item's own: point the readiness
 * URL at something that answers 200 with a body that does not say `ok: true`,
 * and the step must refuse. It is a test rather than a one-off because the
 * alternative is a refusal branch exercised only by running a real deploy
 * against a broken site, which is to say never.
 *
 * @see scripts/lib/readiness.mjs
 * @see scripts/ship.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import { readinessLines, readinessVerdict } from "../scripts/lib/readiness.mjs";

/** What the endpoint actually answers when every check passed. */
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

/** What it answers when a drift check has failed, counts and all. */
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
  // This is the case that stops the step passing against the WRONG URL. Any
  // JSON document on this origin can carry ok:true; only a health report
  // carries a checks array.
  const verdict = readinessVerdict(200, JSON.stringify({ ok: true }));
  assert.equal(verdict.ok, false);
  assert.match(verdict.why, /no checks in its body/);
});

test("a real non-health JSON document on this origin refuses", () => {
  // The shape /blog/feed.json answers with. It is a 200 and valid JSON and it
  // is emphatically not a health report.
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
  // And it must NOT be reported as a failing health check.
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
  // A body that said ok:"yes" would be a shape nobody recognises, and coercing
  // it is how a step stops being able to fail.
  const verdict = readinessVerdict(200, JSON.stringify({ ok: "yes", checks: [{ name: "a", ok: true }] }));
  assert.equal(verdict.ok, false);
});

test("THE DISCRIMINATING CONTROL: healthy and unhealthy do not agree", () => {
  // A verdict function that returned one answer for everything would satisfy
  // every refusal above. This is the pair that proves it can tell two
  // well-formed health reports apart.
  const pass = readinessVerdict(200, HEALTHY);
  const fail = readinessVerdict(503, UNHEALTHY);
  assert.equal(pass.ok, true);
  assert.equal(fail.ok, false);
  assert.notEqual(pass.ok, fail.ok);
});

test("the printed table shows every check, with counts only where sent", () => {
  const lines = readinessLines(JSON.parse(UNHEALTHY).checks);
  assert.equal(lines.length, 5);
  assert.match(lines[0], /FAIL {2}ask-index-drift {2}expected 99, present 90/);
  assert.match(lines[1], /ok {4}media-index-drift$/);
  // A passing check must not invent counts it was not given.
  assert.doesNotMatch(lines[1], /expected/);
});

/*
 * RULING 48: A DRIFTED CORPUS MUST NOT BLOCK ITS OWN REPAIR.
 *
 * The condition, exactly as it happened on 2026-09-09: two posts committed by
 * hand and never synced, so `content-drift` reported `expected 16, present 14`
 * and the endpoint answered 503. Ship deployed, refused at readiness, and left
 * production serving a build whose index nothing had updated. The D1 sync three
 * steps later is what converges that drift.
 */
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
  // The old behaviour, still the behaviour when nothing is deferred: refused.
  const gated = readinessVerdict(503, DRIFTED_CORPUS);
  assert.equal(gated.ok, false, "undeferred, this is still a refusal");
  assert.match(gated.why, /content-drift/);

  // Ship's own list. Deferred, the same body passes the step.
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
  /*
   * THE DISCRIMINATING CONTROL. A deferral that swallowed a second failing
   * check would pass this file's happy cases and destroy the step's purpose,
   * which is stopping a bad deploy before the first production write.
   */
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
