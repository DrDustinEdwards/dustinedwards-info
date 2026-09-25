import test from "node:test";
import assert from "node:assert/strict";

import { ERROR_MIN_SAMPLE, errorRateQuery, errorRateVerdict } from "../app/lib/health/error-rate.mjs";

/** @param {Array<[string, number]>} pairs */
const rows = (pairs) =>
  pairs.map(([status, requests]) => ({ sum: { requests }, dimensions: { status } }));

test("PLANT: the 2026-08-27T00:00Z window, 59 of 180 failing, is reported unhealthy", () => {
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

test("a 1/1 window is NOT an outage, however bad the ratio looks", () => {
  // A bare ratio rule would page on each of the eight 1/1 windows in the measured 30 days.
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

test("the ratio threshold is inclusive at the boundary", () => {
  const exact = errorRateVerdict(rows([["success", 75], ["scriptThrewException", 25]]));
  assert.equal(exact.ok, false, "at the threshold must fail, not squeak through");

  const under = errorRateVerdict(rows([["success", 76], ["scriptThrewException", 24]]));
  assert.equal(under.ok, true);
});

test("clientDisconnected is not counted as this Worker failing", () => {
  // The dataset reports errors: 0 for it, and counting it would make a mobile audience read as an outage.
  const verdict = errorRateVerdict(
    rows([["success", 60], ["clientDisconnected", 40]]),
  );
  assert.equal(verdict.ok, true);
  assert.equal(verdict.errors, 0);
});

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

const WINDOW = {
  accountId: "acct",
  scriptName: "dustinedwards",
  since: "2026-09-07T20:00:00Z",
  until: "2026-09-07T20:15:00Z",
};

test("the query carries the account, the script and both window bounds", () => {
  const built = errorRateQuery(WINDOW);
  assert.equal(built.variables.account, "acct");
  assert.equal(built.variables.script, "dustinedwards");
  assert.equal(built.variables.since, "2026-09-07T20:00:00Z");
  assert.equal(built.variables.until, "2026-09-07T20:15:00Z");
});

// The watchdog's fetch-and-unwrap around these is tested on the real code in test/worker/watchdog.test.ts.
