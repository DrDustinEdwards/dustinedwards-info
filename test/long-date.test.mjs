/**
 * One owner for the human date, and the defect the majority copy carried.
 *
 * REPLAYS THE DEFECT, per hard rule 12. Two of the three `formatDate` copies
 * handed an unparseable value to `toLocaleDateString`, which answers the STRING
 * "Invalid Date" rather than throwing. Measured against the old body before the
 * change: `formatDate("rubbish")` returned "Invalid Date", so a bad `publishAt`
 * on a public post rendered those words under the title.
 *
 * @see app/lib/long-date.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import { longDateUTC } from "../app/lib/long-date.mjs";

test("a date renders as the long form", () => {
  assert.equal(longDateUTC("2026-01-05T00:00:00Z"), "January 5, 2026");
});

test("AN UNPARSEABLE DATE IS NULL, never the words 'Invalid Date'", () => {
  // The whole reason this module exists. `new Date("rubbish").toLocaleDateString()`
  // returns the string "Invalid Date", and the two blog copies rendered it.
  for (const bad of ["rubbish", "2026-13-45", new Date("nope"), Number.NaN]) {
    const out = longDateUTC(bad);
    assert.equal(out, null, `${String(bad)} must be null`);
    assert.doesNotMatch(String(out), /Invalid/, "must never reach a reader");
  }
});

test("absence is null, and empty string counts as absence", () => {
  for (const missing of [null, undefined, ""]) {
    assert.equal(longDateUTC(missing), null);
  }
});

test("UTC, so the server render and the hydrated one cannot disagree", () => {
  // A timestamp late enough in the UTC day that any negative-offset zone would
  // format it as the PREVIOUS date. If this ever reads "March 9" the timeZone
  // option has been dropped and every caller has a hydration mismatch.
  assert.equal(longDateUTC("2026-03-10T23:30:00Z"), "March 10, 2026");
});

test("a Date object, an ISO string and an epoch number agree", () => {
  const iso = "2026-01-05T00:00:00Z";
  const expected = "January 5, 2026";
  for (const shape of [iso, new Date(iso), Date.parse(iso)]) {
    assert.equal(longDateUTC(shape), expected, `${String(shape)} must agree`);
  }
});

test("the epoch itself formats rather than reading as absent", () => {
  // 0 is falsy, and the old blog copies started with `if (!value) return null`,
  // so they answered null for a real instant.
  assert.equal(longDateUTC(0), "January 1, 1970");
});
