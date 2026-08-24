/**
 * The two date renderings in the media library, and the one parse behind them.
 *
 * Written with the 2026-08-24 consolidation, which removed a second copy of the
 * UTC parse and a second hand-written list of month names. The equivalence was
 * proven at the time by a differential against the old bodies over 61 values
 * (122 comparisons, 0 disagreements, control differing on 69). A differential is
 * a one-off; these are what stop the two copies coming back.
 *
 * ## WHAT IS ACTUALLY AT RISK HERE
 *
 * `monthOf` renders a group HEADING and `formatAdded` renders the Added CELL
 * under it. They appear on the same screen, describing the same row, so the
 * failure mode is not a crash: it is a row filed under "No upload date" whose
 * own cell prints a date, or a heading saying August over a cell saying Jul.
 * Every assertion below is about the two of them AGREEING.
 *
 * @see app/lib/media/view.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import { formatAdded, monthOf } from "../app/lib/media/view.mjs";

/** Noon UTC on the 15th of each month of 2025, so no boundary is in play. */
const MIDMONTH = Array.from(
  { length: 12 },
  (_, m) => `2025-${String(m + 1).padStart(2, "0")}-15T12:00:00.000Z`,
);

const FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

test("every month renders its full name in the heading", () => {
  assert.deepEqual(
    MIDMONTH.map((iso) => monthOf(iso)),
    FULL.map((name) => `${name} 2025`),
  );
});

test("THE DERIVATION: every abbreviation is the first three letters of its name", () => {
  // MONTH_ABBR is derived with `.slice(0, 3)` rather than hand-written, and
  // that is only legal because it holds for all twelve English months with no
  // exception. This is the assertion that makes the derivation a fact rather
  // than a convenience, and it is why the second list could be deleted.
  const rendered = MIDMONTH.map((iso) => formatAdded(iso).split(" ")[1]);
  assert.deepEqual(rendered, FULL.map((name) => name.slice(0, 3)));
  assert.deepEqual(rendered, [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]);
});

test("both renderings are UTC, so a late-evening upload cannot split them", () => {
  // 23:30 UTC on the last day of a month is the case both docblocks name: read
  // in local time, a reader east of UTC sees the next day and possibly the next
  // month, and the heading and the cell then disagree on one screen.
  assert.equal(monthOf("2025-01-31T23:30:00.000Z"), "January 2025");
  assert.equal(formatAdded("2025-01-31T23:30:00.000Z"), "31 Jan 2025");

  assert.equal(monthOf("2025-02-01T00:30:00.000Z"), "February 2025");
  assert.equal(formatAdded("2025-02-01T00:30:00.000Z"), "01 Feb 2025");
});

test("the day is zero padded, so the column stays aligned", () => {
  assert.equal(formatAdded("2025-03-05T12:00:00.000Z"), "05 Mar 2025");
  assert.equal(formatAdded("2025-03-25T12:00:00.000Z"), "25 Mar 2025");
});

test("leap day is a real date to both", () => {
  assert.equal(monthOf("2024-02-29T00:00:00.000Z"), "February 2024");
  assert.equal(formatAdded("2024-02-29T00:00:00.000Z"), "29 Feb 2024");
});

/*
 * THE SHARED PARSE, asserted as agreement rather than by reaching for the
 * private helper. Two copies of "is this timestamp usable" is the defect that
 * was removed; what a test can see is that the two callers never disagree about
 * it. The words they use differ on purpose: a heading says the date is missing,
 * a cell says where the file came from instead.
 */
for (const unusable of [null, undefined, "", "   ", "not a date", "2026-13-45"]) {
  test(`both refuse ${JSON.stringify(unusable)}, and refuse it together`, () => {
    assert.equal(monthOf(unusable), "No upload date");
    assert.equal(formatAdded(unusable), "in repo");
  });
}

test("a real uploaded_at from the deployed table renders in both", () => {
  // Taken from the media table on 2026-08-24. The whole real corpus sits inside
  // one minute of one day, which is exactly why every other test here is
  // synthetic: the live data cannot exercise a single month boundary.
  assert.equal(monthOf("2026-08-23T20:38:59.620Z"), "August 2026");
  assert.equal(formatAdded("2026-08-23T20:38:59.620Z"), "23 Aug 2026");
});

test("NO CLOCK IS READ: the same input renders the same string whatever today is", () => {
  const iso = "2020-06-15T12:00:00.000Z";
  assert.equal(monthOf(iso), "June 2020");
  assert.equal(formatAdded(iso), "15 Jun 2020");
});
