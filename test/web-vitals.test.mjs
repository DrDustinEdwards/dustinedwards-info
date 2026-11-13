// The grading half of check:web-vitals. The measuring half needs a browser and a deploy, so the
// part that decides ok, WARN, FAIL and the exit code is pinned here without either.

import test from "node:test";
import assert from "node:assert/strict";

import { exitCode, grade, gradeRuns } from "../scripts/lib/web-vitals.mjs";

await test("at or under the threshold is ok; strictly over is WARN", () => {
  assert.equal(grade(0, 2500), "ok");
  assert.equal(grade(2500, 2500), "ok", "exactly at the threshold is not over it");
  assert.equal(grade(2501, 2500), "WARN");
  assert.equal(grade(0.1, 0.1), "ok");
  assert.equal(grade(0.1001, 0.1), "WARN");
});

await test("exactly twice the threshold is WARN; strictly more than twice is FAIL", () => {
  assert.equal(grade(5000, 2500), "WARN", "exactly 2x is not MORE than twice");
  assert.equal(grade(5001, 2500), "FAIL");
  assert.equal(grade(400, 200), "WARN");
  assert.equal(grade(401, 200), "FAIL");
  assert.equal(grade(0.2, 0.1), "WARN");
  assert.equal(grade(0.21, 0.1), "FAIL");
});

await test("a value that is not a measurement is refused, never graded ok", () => {
  assert.throws(() => grade(Number.NaN, 200));
  assert.throws(() => grade(Number.POSITIVE_INFINITY, 200));
  assert.throws(() => grade(-1, 200));
});

await test("gradeRuns grades the median of each metric, not the worst or the first run", () => {
  const grades = gradeRuns([
    { lcp: 6000, cls: 0, tbt: 0 },
    { lcp: 2000, cls: 0.05, tbt: 450 },
    { lcp: 2400, cls: 0.3, tbt: 100 },
  ]);
  const byKey = Object.fromEntries(grades.map((g) => [g.metric.key, g]));
  assert.equal(byKey.lcp.value, 2400);
  assert.equal(byKey.lcp.grade, "ok");
  assert.equal(byKey.cls.value, 0.05);
  assert.equal(byKey.tbt.value, 100);
});

await test("exit code: 0 with only warnings, 1 on any FAIL, 2 when any page is unmeasured", () => {
  const ok = { grades: [{ grade: "ok" }, { grade: "ok" }] };
  const warn = { grades: [{ grade: "WARN" }, { grade: "ok" }] };
  const fail = { grades: [{ grade: "FAIL" }, { grade: "ok" }] };
  const unmeasured = { error: new Error("NO_NAVSTART") };
  assert.equal(exitCode([ok, ok]), 0);
  assert.equal(exitCode([ok, warn]), 0, "a warning reports and does not block");
  assert.equal(exitCode([warn, fail]), 1);
  assert.equal(exitCode([ok, unmeasured]), 2);
  assert.equal(exitCode([fail, unmeasured]), 2, "an unmeasured page outranks a FAIL elsewhere");
  assert.equal(exitCode([{}]), 2, "a page with neither grades nor an error is not a pass");
});
