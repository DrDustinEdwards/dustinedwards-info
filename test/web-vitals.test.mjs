// The grading half of check:web-vitals. The measuring half needs a browser and a deploy, so the
// part that decides ok, WARN, FAIL and the exit code is pinned here without either.

import test from "node:test";
import assert from "node:assert/strict";

import {
  METRICS,
  exitCode,
  firstArticlePath,
  grade,
  gradeRuns,
  median,
} from "../scripts/lib/web-vitals.mjs";

test("the thresholds are the job's: LCP 2.5s, CLS 0.1, and TBT 200ms as the named INP proxy", () => {
  const byKey = Object.fromEntries(METRICS.map((m) => [m.key, m]));
  assert.equal(byKey.lcp.threshold, 2500);
  assert.equal(byKey.cls.threshold, 0.1);
  assert.equal(byKey.tbt.threshold, 200);
  assert.match(byKey.tbt.label, /proxy for INP/, "TBT must never be printed as if it were INP");
});

test("at or under the threshold is ok; strictly over is WARN", () => {
  assert.equal(grade(0, 2500), "ok");
  assert.equal(grade(2500, 2500), "ok", "exactly at the threshold is not over it");
  assert.equal(grade(2501, 2500), "WARN");
  assert.equal(grade(0.1, 0.1), "ok");
  assert.equal(grade(0.1001, 0.1), "WARN");
});

test("exactly twice the threshold is WARN; strictly more than twice is FAIL", () => {
  assert.equal(grade(5000, 2500), "WARN", "exactly 2x is not MORE than twice");
  assert.equal(grade(5001, 2500), "FAIL");
  assert.equal(grade(400, 200), "WARN");
  assert.equal(grade(401, 200), "FAIL");
  assert.equal(grade(0.2, 0.1), "WARN");
  assert.equal(grade(0.21, 0.1), "FAIL");
});

test("a value that is not a measurement is refused, never graded ok", () => {
  assert.throws(() => grade(Number.NaN, 200));
  assert.throws(() => grade(Number.POSITIVE_INFINITY, 200));
  assert.throws(() => grade(-1, 200));
});

test("median: odd counts take the middle, even counts average the middle two", () => {
  assert.equal(median([3000]), 3000);
  assert.equal(median([9000, 1000, 2000]), 2000, "one slow outlier run does not decide");
  assert.equal(median([1, 4, 2, 3]), 2.5);
  const input = [3, 1, 2];
  median(input);
  assert.deepEqual(input, [3, 1, 2], "median must not reorder the caller's array");
});

test("median of no runs throws, because an unmeasured page has no number", () => {
  assert.throws(() => median([]), /no runs/);
  assert.throws(() => median([1, Number.NaN, 3]));
});

test("gradeRuns grades the median of each metric, not the worst or the first run", () => {
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

test("exit code: 0 with only warnings, 1 on any FAIL, 2 when any page is unmeasured", () => {
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

test("firstArticlePath takes the first single-segment /writing link and skips tags", () => {
  const html =
    '<a href="/writing">All</a><a href="/writing/tags/cloudflare">t</a>' +
    '<a href="/writing/ten-years-on-cloudflare">p</a><a href="/writing/other-post">q</a>';
  assert.equal(firstArticlePath(html), "/writing/ten-years-on-cloudflare");
  assert.equal(firstArticlePath('<a href="/writing/feed">f</a>'), null);
  assert.equal(firstArticlePath("<p>nothing</p>"), null);
});
