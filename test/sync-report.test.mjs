import test from "node:test";
import assert from "node:assert/strict";

import {
  askSyncReport,
  mediaSyncReport,
  mediaSyncSummary,
} from "../app/lib/operator/sync-report.mjs";

const SYNCED = { job: "j1", ended: true, expected: 191, present: 191, refused: 0, indexing: 0 };

await test("an ended sync whose index matches its query is converged, with zero drift", () => {
  const r = askSyncReport(SYNCED);
  assert.equal(r.converged, true);
  assert.equal(r.drift, 0);
});

await test("a short index is NOT converged, and drift is absolute either way", () => {
  // More present than expected is a withdrawn post still answering; a negative drift would read as healthy.
  assert.equal(askSyncReport({ ...SYNCED, present: 160 }).converged, false);
  assert.equal(askSyncReport({ ...SYNCED, present: 222 }).drift, 31, "not -31");
});

await test("a sync that had not ended, or a refused row, is not converged even when the counts agree", () => {
  assert.equal(askSyncReport({ ...SYNCED, ended: false }).converged, false);
  assert.equal(askSyncReport({ ...SYNCED, refused: 1 }).converged, false);
});

await test("AN UNREADABLE COUNT FAILS CLOSED, and converged is never taken from the caller", () => {
  for (const bad of [null, undefined, Number.NaN, "191", 1.5]) {
    assert.equal(
      askSyncReport({ ...SYNCED, expected: bad, present: bad }).converged,
      false,
      `expected/present ${String(bad)} must not converge`,
    );
    assert.equal(askSyncReport({ ...SYNCED, refused: bad }).converged, false);
  }
  assert.equal(askSyncReport({ ...SYNCED, present: 90, converged: true }).converged, false);
});

/* The media index drifts by KEY, so the two totals can agree while the index is wrong in
 * both directions at once. */

const CLEAN = {
  indexed: 69,
  removed: 0,
  failures: [],
  expected: 69,
  present: 69,
  missing: [],
  extra: [],
};

await test("media: a real convergence reports converged and zero drift", () => {
  const r = mediaSyncReport(CLEAN);
  assert.equal(r.converged, true);
  assert.equal(r.drift, 0);
  assert.equal(r.expected, 69);
  assert.equal(r.present, 69);
});

await test("media: THE CASE A COUNT COMPARISON CANNOT SEE", () => {
  /* Identical totals and the index wrong twice: this is why the media report compares key
   * SETS rather than reusing the count comparison. */
  const r = mediaSyncReport({
    ...CLEAN,
    missing: ["/fonts/OFL.txt"],
    extra: ["/deleted-thing.png"],
  });
  assert.equal(r.expected, 69);
  assert.equal(r.present, 69);
  assert.equal(r.converged, false);
  assert.equal(r.drift, 2);
});

await test("media: THE OFL.txt CASE, which is the one this door was built for", () => {
  const r = mediaSyncReport({
    ...CLEAN,
    expected: 69,
    present: 68,
    missing: ["/fonts/OFL.txt"],
  });
  assert.equal(r.converged, false);
  assert.equal(r.drift, 1);
  assert.deepEqual(r.missing, ["/fonts/OFL.txt"]);
});

await test("media: a key that FAILED to derive is not convergence", () => {
  /* A key that threw leaves no row and an unchanged source, so both key sets agree; only the
   * failure list says anything is wrong. */
  const r = mediaSyncReport({ ...CLEAN, failures: ["/x.png: IMAGES returned 500"] });
  assert.equal(r.expected, r.present);
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.extra, []);
  assert.equal(r.converged, false);
  assert.deepEqual(r.failures, ["/x.png: IMAGES returned 500"]);
});

await test("media: converged is never taken from the caller", () => {
  const r = mediaSyncReport({
    ...CLEAN,
    present: 60,
    missing: ["/a.png"],
    converged: true,
    ok: true,
    drift: 0,
  });
  assert.equal(r.converged, false);
});

await test("media: an unreadable count is not a passing count", () => {
  for (const bad of [null, undefined, NaN, "69", 1.5]) {
    assert.equal(mediaSyncReport({ ...CLEAN, expected: bad }).converged, false, `expected=${bad}`);
    assert.equal(mediaSyncReport({ ...CLEAN, present: bad }).converged, false, `present=${bad}`);
  }
});

await test("media: a non-array missing, extra or failure list fails closed without a crash", () => {
  // A report that cannot say what failed has not converged (Dustin's ruling, job_acaa730fcbc8).
  const r = mediaSyncReport({ ...CLEAN, missing: "nope", extra: null, failures: 7 });
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.extra, []);
  assert.deepEqual(r.failures, []);
  assert.equal(r.converged, false);
  assert.equal(r.unreadable, true);
  assert.match(mediaSyncSummary(r), /unreadable/);

  for (const bad of [{ failures: 7 }, { failures: undefined }, { missing: null }, { extra: "x" }]) {
    assert.equal(mediaSyncReport({ ...CLEAN, ...bad }).converged, false, JSON.stringify(bad));
  }
});

await test("media: a failure entry that is not a string still counts as a failure", () => {
  const r = mediaSyncReport({ ...CLEAN, failures: [{ key: "/x.png" }] });
  assert.equal(r.converged, false);
  assert.equal(r.unreadable, true);
});

await test("media: the summary names what is wrong, not just that something is", () => {
  const good = mediaSyncSummary(mediaSyncReport(CLEAN));
  assert.match(good, /converged/);
  assert.match(good, /69 expected/);

  const bad = mediaSyncSummary(
    mediaSyncReport({ ...CLEAN, present: 68, missing: ["/fonts/OFL.txt"], failures: ["/x: boom"] }),
  );
  assert.match(bad, /69 expected/);
  assert.match(bad, /68 present/);
  assert.match(bad, /1 missing/);
  assert.match(bad, /1 failed to derive/);
});
