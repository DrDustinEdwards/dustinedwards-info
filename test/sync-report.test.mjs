/**
 * What a sync call is allowed to call success. Both indexes.
 *
 * THE DEFECT THIS GUARDS. `ship` runs the operation and fails the run when it
 * does not converge, so an operation that reported ok by virtue of having been
 * CALLED would turn that gate into a green light meaning nothing: the deploy
 * lands, ship says shipped, and the Ask index is still short. That is exactly
 * the state the scheduled health check caught by hand on 2026-08-23, four polls
 * running, expected 91 present 90.
 *
 * So converged is DERIVED from the two counts read back after the writes, never
 * asserted by the caller. The plant for this is an operation that returns
 * success without uploading; these assertions are what refuses it.
 *
 * @see app/lib/operator/sync-report.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  askSyncReport,
  askSyncSummary,
  mediaSyncReport,
  mediaSyncSummary,
} from "../app/lib/operator/sync-report.mjs";

test("a real convergence reports converged and zero drift", () => {
  const r = askSyncReport({ uploaded: 122, removed: 0, cacheDropped: 3, expected: 122, present: 122 });
  assert.equal(r.converged, true);
  assert.equal(r.drift, 0);
  assert.equal(r.expected, 122);
  assert.equal(r.present, 122);
});

test("SUCCESS WITHOUT UPLOADING IS NOT CONVERGED, which is the plant", () => {
  // An operation that answered ok having written nothing, while the index is
  // short. The counts are the only thing that can tell, so they are the only
  // thing trusted.
  const r = askSyncReport({ uploaded: 0, removed: 0, cacheDropped: 0, expected: 122, present: 90 });
  assert.equal(r.converged, false, "an untouched short index must never read as converged");
  assert.equal(r.drift, 32);
  assert.match(askSyncSummary(r), /STILL SHORT/);
});

test("uploading a lot and still being short is NOT converged either", () => {
  // The loop ran, it wrote plenty, and the read-back still disagrees. `uploaded`
  // is what the loop THINKS it did; only the read-back can contradict it.
  const r = askSyncReport({ uploaded: 122, removed: 0, cacheDropped: 0, expected: 122, present: 121 });
  assert.equal(r.converged, false);
  assert.equal(r.drift, 1);
});

test("DRIFT IS ABSOLUTE, because a too-large index is also wrong", () => {
  // More present than expected is stale items nobody pruned, which is how a
  // withdrawn post keeps answering. A negative number here would read as
  // healthy to any caller comparing drift > 0.
  const r = askSyncReport({ uploaded: 0, removed: 0, cacheDropped: 0, expected: 90, present: 122 });
  assert.equal(r.drift, 32, "not -32");
  assert.equal(r.converged, false);
});

test("AN UNREADABLE COUNT FAILS CLOSED", () => {
  // Same stance ftsEqualityVerdict takes. A count that could not be read must
  // not average out to agreement.
  for (const bad of [null, undefined, Number.NaN, "122", 1.5]) {
    assert.equal(
      askSyncReport({ uploaded: 1, removed: 0, cacheDropped: 0, expected: bad, present: bad }).converged,
      false,
      `expected/present ${String(bad)} must not converge`,
    );
  }
});

test("converged is never taken from the caller", () => {
  // Passing it in must change nothing: it is derived or it is worthless.
  const r = askSyncReport({
    uploaded: 0, removed: 0, cacheDropped: 0, expected: 122, present: 90,
    converged: true, ok: true, drift: 0,
  });
  assert.equal(r.converged, false);
  assert.equal(r.drift, 32);
});

test("the summary carries both counts either way, so a log line is diagnosable", () => {
  const good = askSyncSummary(askSyncReport({ uploaded: 5, removed: 1, cacheDropped: 0, expected: 7, present: 7 }));
  assert.match(good, /7 expected/);
  assert.match(good, /7 present/);
  const bad = askSyncSummary(askSyncReport({ uploaded: 5, removed: 1, cacheDropped: 0, expected: 9, present: 7 }));
  assert.match(bad, /9 expected/);
  assert.match(bad, /7 present/);
  assert.match(bad, /drift 2/);
});

/* -------------------------------------------------------------------------
 * sync_media. Same rule, a different measurement, and the difference is the
 * point of these: the media index drifts by KEY, so a comparison of the two
 * totals can agree while the index is wrong in both directions at once.
 * ---------------------------------------------------------------------- */

const CLEAN = {
  indexed: 69,
  removed: 0,
  failures: [],
  expected: 69,
  present: 69,
  missing: [],
  extra: [],
};

test("media: a real convergence reports converged and zero drift", () => {
  const r = mediaSyncReport(CLEAN);
  assert.equal(r.converged, true);
  assert.equal(r.drift, 0);
  assert.equal(r.expected, 69);
  assert.equal(r.present, 69);
});

test("media: THE CASE A COUNT COMPARISON CANNOT SEE", () => {
  /*
   * The totals are identical and the index is wrong twice: one real asset has
   * no row, and one row describes something that no longer exists. `sync_ask`'s
   * shape would call this converged, correctly for a count comparison and
   * wrongly for this one. This assertion is the entire reason the media report
   * compares key SETS rather than reusing the answer index's verdict.
   */
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

test("media: THE OFL.txt CASE, which is the one this door was built for", () => {
  // One public file with no D1 row: the standing red that waited weeks for a
  // click. Expected exceeds present by exactly one and the key is named.
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

test("media: a key that FAILED to derive is not convergence", () => {
  /*
   * The subtle one. A key that threw during the rebuild leaves no row, and it
   * also leaves the source unchanged, so a reconciler that only compared sets
   * would see the same key on both sides and agree. Both totals match here and
   * both key sets are empty; only the failure list says anything is wrong.
   */
  const r = mediaSyncReport({ ...CLEAN, failures: ["/x.png: IMAGES returned 500"] });
  assert.equal(r.expected, r.present);
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.extra, []);
  assert.equal(r.converged, false);
  assert.deepEqual(r.failures, ["/x.png: IMAGES returned 500"]);
});

test("media: converged is never taken from the caller", () => {
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

test("media: an unreadable count is not a passing count", () => {
  for (const bad of [null, undefined, NaN, "69", 1.5]) {
    assert.equal(mediaSyncReport({ ...CLEAN, expected: bad }).converged, false, `expected=${bad}`);
    assert.equal(mediaSyncReport({ ...CLEAN, present: bad }).converged, false, `present=${bad}`);
  }
});

test("media: a non-array missing or extra cannot smuggle a pass or a crash", () => {
  const r = mediaSyncReport({ ...CLEAN, missing: "nope", extra: null, failures: 7 });
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.extra, []);
  assert.deepEqual(r.failures, []);
  assert.equal(r.converged, true);
});

test("media: the summary names what is wrong, not just that something is", () => {
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
