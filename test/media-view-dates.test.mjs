/* `monthOf` renders a group heading and `formatAdded` the cell under it, on one screen, so
 * every assertion is about the two AGREEING. */

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
  // MONTH_ABBR is derived with `.slice(0, 3)`, which is legal only because that holds for all
  // twelve English months.
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

/* The words differ on purpose: a heading says the date is missing, a cell says where the file
 * came from instead. */
for (const unusable of [null, undefined, "", "   ", "not a date", "2026-13-45"]) {
  test(`both refuse ${JSON.stringify(unusable)}, and refuse it together`, () => {
    assert.equal(monthOf(unusable), "No upload date");
    assert.equal(formatAdded(unusable), "in repo");
  });
}

test("a real uploaded_at from the deployed table renders in both", () => {
  // From the media table. The real corpus sits inside one minute of one day, which is why every
  // other test here is synthetic: it cannot exercise a month boundary.
  assert.equal(monthOf("2026-08-23T20:38:59.620Z"), "August 2026");
  assert.equal(formatAdded("2026-08-23T20:38:59.620Z"), "23 Aug 2026");
});

test("NO CLOCK IS READ: the same input renders the same string whatever today is", (t) => {
  const iso = "2020-06-15T12:00:00.000Z";
  t.mock.timers.enable({ apis: ["Date"] });
  for (const today of [Date.UTC(2020, 5, 15, 12), Date.UTC(2031, 0, 1), Date.UTC(1999, 11, 31, 23, 59)]) {
    t.mock.timers.setTime(today);
    assert.equal(monthOf(iso), "June 2020", `with today at ${new Date(today).toISOString()}`);
    assert.equal(formatAdded(iso), "15 Jun 2020", `with today at ${new Date(today).toISOString()}`);
  }
});
