import test from "node:test";
import assert from "node:assert/strict";

import {
  askSyncReport,
  askSyncSummary,
  mediaSyncReport,
  mediaSyncSummary,
} from "../app/lib/operator/sync-report.mjs";

await test("a real convergence reports converged and zero drift", () => {
  const r = askSyncReport({
    uploaded: 122,
    removed: 0,
    cacheDropped: 3,
    expected: 122,
    present: 122,
  });
  assert.equal(r.converged, true);
  assert.equal(r.drift, 0);
  assert.equal(r.expected, 122);
  assert.equal(r.present, 122);
});

await test("SUCCESS WITHOUT UPLOADING IS NOT CONVERGED, which is the plant", () => {
  // The counts are the only thing that can tell, so they are the only thing trusted.
  const r = askSyncReport({ uploaded: 0, removed: 0, cacheDropped: 0, expected: 122, present: 90 });
  assert.equal(r.converged, false, "an untouched short index must never read as converged");
  assert.equal(r.drift, 32);
  assert.match(askSyncSummary(r), /STILL SHORT/);
});

await test("uploading a lot and still being short is NOT converged either", () => {
  // `uploaded` is what the loop THINKS it did; only the read-back can contradict it.
  const r = askSyncReport({
    uploaded: 122,
    removed: 0,
    cacheDropped: 0,
    expected: 122,
    present: 121,
  });
  assert.equal(r.converged, false);
  assert.equal(r.drift, 1);
});

await test("DRIFT IS ABSOLUTE, because a too-large index is also wrong", () => {
  // More present than expected is stale items, which is how a withdrawn post keeps answering.
  // A negative drift would read as healthy to any caller comparing drift > 0.
  const r = askSyncReport({ uploaded: 0, removed: 0, cacheDropped: 0, expected: 90, present: 122 });
  assert.equal(r.drift, 32, "not -32");
  assert.equal(r.converged, false);
});

await test("AN UNREADABLE COUNT FAILS CLOSED", () => {
  // A count that could not be read must not average out to agreement.
  for (const bad of [null, undefined, Number.NaN, "122", 1.5]) {
    assert.equal(
      askSyncReport({ uploaded: 1, removed: 0, cacheDropped: 0, expected: bad, present: bad })
        .converged,
      false,
      `expected/present ${String(bad)} must not converge`,
    );
  }
});

await test("converged is never taken from the caller", () => {
  // Passing it in must change nothing: it is derived or it is worthless.
  const r = askSyncReport({
    uploaded: 0,
    removed: 0,
    cacheDropped: 0,
    expected: 122,
    present: 90,
    converged: true,
    ok: true,
    drift: 0,
  });
  assert.equal(r.converged, false);
  assert.equal(r.drift, 32);
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

await test("ask: an unreadable failure list is not converged, an absent one is", () => {
  const counts = { uploaded: 5, removed: 0, cacheDropped: 0, expected: 5, present: 5 };
  for (const bad of [7, null, "nope", {}]) {
    const r = askSyncReport({ ...counts, failed: bad });
    assert.equal(r.converged, false, `failed=${JSON.stringify(bad)}`);
    assert.match(askSyncSummary(r), /UNREADABLE/);
  }
  assert.equal(askSyncReport(counts).converged, true);
});
