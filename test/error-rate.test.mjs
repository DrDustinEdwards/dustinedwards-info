/**
 * Whether the watchdog wakes somebody about the Worker throwing.
 *
 * REPLAYS THE DEFECT, per the replay rule, and the defect here is the one the
 * whole error-rate check was written for: **nothing alerted on error rate at
 * all**, so an hourly cron registered on a Worker with no `scheduled()` handler
 * threw 24 times a day from 2026-08-23 to 2026-09-07 and the site reported
 * perfect health throughout. `/api/health` was green every poll, because every
 * one of its five checks is a DRIFT check and none of them can see a crash.
 *
 * So the first replay below is that shape: a window where a large share of
 * invocations failed while nothing else in the system had anything to say.
 *
 * The two cases after it are the ones that decided the threshold's SHAPE, and
 * they are here because each was a candidate rule that the 30-day replay
 * rejected. A test that only checked "high ratio fails" would pass against a
 * bare-ratio rule that pages on a single failed request at 3am.
 *
 * @see app/lib/health/error-rate.mjs
 * @see workers/watchdog.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ERROR_MIN_SAMPLE,
  ERROR_RATIO_THRESHOLD,
  errorRateQuery,
  errorRateVerdict,
} from "../app/lib/health/error-rate.mjs";

/** @param {Array<[string, number]>} pairs */
const rows = (pairs) =>
  pairs.map(([status, requests]) => ({ sum: { requests }, dimensions: { status } }));

/* ---- THE REPLAY: a real failing window from the measured 30 days --------- */

test("PLANT: the 2026-08-27T00:00Z window, 59 of 180 failing, is reported unhealthy", () => {
  // The real bucket, reconstructed: 59 errors against 180 total invocations.
  const verdict = errorRateVerdict(
    rows([
      ["success", 121],
      ["scriptThrewException", 45],
      ["loadShed", 14],
    ]),
  );
  assert.equal(verdict.ok, false);
  assert.equal(verdict.total, 180);
  assert.equal(verdict.errors, 59);
  assert.match(verdict.detail, /59 of 180/);
  assert.match(verdict.detail, /32\.8%/);
});

test("the other real firing window, 12 of 36, is reported unhealthy", () => {
  const verdict = errorRateVerdict(
    rows([
      ["success", 24],
      ["scriptThrewException", 12],
    ]),
  );
  assert.equal(verdict.ok, false);
  assert.equal(verdict.errors, 12);
});

/* ---- WHY THERE IS A MINIMUM SAMPLE -------------------------------------- */

test("a 1/1 window is NOT an outage, however bad the ratio looks", () => {
  // Eight windows in the measured 30 days were exactly this. A bare ratio rule
  // pages on every one of them.
  const verdict = errorRateVerdict(rows([["scriptThrewException", 1]]));
  assert.equal(verdict.ok, true);
  assert.equal(verdict.ratio, 1);
  assert.match(verdict.detail, /Not judged/);
});

test("the sample floor is exclusive: one under is not judged, exactly at it is", () => {
  const under = errorRateVerdict(
    rows([["scriptThrewException", ERROR_MIN_SAMPLE - 1]]),
  );
  assert.equal(under.ok, true, "one invocation under the floor must not be judged");

  const at = errorRateVerdict(rows([["scriptThrewException", ERROR_MIN_SAMPLE]]));
  assert.equal(at.ok, false, "exactly at the floor must be judged");
});

/* ---- THE THRESHOLD BOUNDARY --------------------------------------------- */

test("the ratio threshold is inclusive at the boundary", () => {
  // 25 errors of 100 is exactly 0.25.
  const exact = errorRateVerdict(rows([["success", 75], ["scriptThrewException", 25]]));
  assert.equal(exact.ok, false, "at the threshold must fail, not squeak through");

  const under = errorRateVerdict(rows([["success", 76], ["scriptThrewException", 24]]));
  assert.equal(under.ok, true);
});

/* ---- WHAT IS NOT AN ERROR ------------------------------------------------ */

test("clientDisconnected is not counted as this Worker failing", () => {
  // A reader closing the tab. The dataset itself reports errors: 0 for it, and
  // counting it would make a mobile audience read as an outage.
  const verdict = errorRateVerdict(
    rows([["success", 60], ["clientDisconnected", 40]]),
  );
  assert.equal(verdict.ok, true);
  assert.equal(verdict.errors, 0);
});

/* ---- FAIL CLOSED --------------------------------------------------------- */

test("an unreadable response is UNHEALTHY, never silently zero errors", () => {
  for (const bad of [null, undefined, {}, "nope", 42]) {
    const verdict = errorRateVerdict(bad);
    assert.equal(verdict.ok, false, `${JSON.stringify(bad)} must not read as healthy`);
    assert.match(verdict.detail, /unknown|no rows/i);
  }
});

test("a row whose count does not parse is skipped, not coerced to zero", () => {
  const verdict = errorRateVerdict([
    { sum: { requests: 30 }, dimensions: { status: "success" } },
    { sum: { requests: "banana" }, dimensions: { status: "scriptThrewException" } },
  ]);
  // The unparseable row contributes to neither side, so 30 clean successes
  // remain 30 and the window is healthy rather than falsely 0/30.
  assert.equal(verdict.total, 30);
  assert.equal(verdict.errors, 0);
  assert.equal(verdict.ok, true);
});

test("an empty window does not divide by zero", () => {
  const verdict = errorRateVerdict([]);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.ratio, 0);
  assert.equal(Number.isNaN(verdict.ratio), false);
});

/* ---- THE QUERY ----------------------------------------------------------- */

test("the query carries the account, the script and both window bounds", () => {
  const built = errorRateQuery({
    accountId: "acct",
    scriptName: "dustinedwards",
    since: "2026-09-07T20:00:00Z",
    until: "2026-09-07T20:15:00Z",
  });
  assert.equal(built.variables.account, "acct");
  assert.equal(built.variables.script, "dustinedwards");
  assert.equal(built.variables.since, "2026-09-07T20:00:00Z");
  assert.equal(built.variables.until, "2026-09-07T20:15:00Z");
  // The script filter is what keeps the watchdog's own invocations out of the
  // site's error rate. Asserted on the document, because dropping it would
  // still return a plausible number.
  assert.match(built.query, /scriptName: \$script/);
  assert.match(built.query, /workersInvocationsAdaptive/);
});

test("the ratio threshold and sample floor are the values the 30 days chose", () => {
  // Pinned so a change is a deliberate diff with a re-measurement behind it,
  // rather than a number somebody nudged to quieten an alert.
  assert.equal(ERROR_RATIO_THRESHOLD, 0.25);
  assert.equal(ERROR_MIN_SAMPLE, 20);
});
