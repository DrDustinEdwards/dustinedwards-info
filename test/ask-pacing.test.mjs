import test from "node:test";
import assert from "node:assert/strict";

import { pacedAllowance, secondsPerPacedUnit } from "../app/lib/search/ask-pacing.mjs";

const DAILY = 200;
const BURST = 25;

/** A UTC instant that many seconds into 2026-08-23. */
const at = (seconds) => new Date(Date.UTC(2026, 7, 23, 0, 0, 0) + seconds * 1000);

test("THE DEFECT: a burst at midnight cannot take the whole day", () => {
  // Under a flat cap all 200 units are available at 00:00:01, so a distributed caller takes the whole day.
  const atOpening = pacedAllowance(DAILY, BURST, at(1));
  assert.ok(
    atOpening < DAILY,
    `${atOpening} of ${DAILY} available one second into the day: the cliff is intact`,
  );
  assert.equal(atOpening, BURST, "one second in, the allowance is exactly the burst");
});

test("the day still recovers continuously after such a burst", () => {
  const anHourLater = pacedAllowance(DAILY, BURST, at(3600));
  assert.ok(
    anHourLater > BURST,
    `${anHourLater} an hour in is no better than the ${BURST} already spent`,
  );
});

test("the full ceiling is still the ceiling and is never exceeded", () => {
  for (const seconds of [0, 1, 3600, 43200, 86399]) {
    const allowed = pacedAllowance(DAILY, BURST, at(seconds));
    assert.ok(
      allowed <= DAILY,
      `${allowed} at ${seconds}s exceeds the daily cap of ${DAILY}`,
    );
  }
  assert.equal(pacedAllowance(DAILY, BURST, at(86399)), DAILY);
});

test("the allowance never goes backwards as the day advances", () => {
  let previous = -1;
  for (let seconds = 0; seconds <= 86400; seconds += 900) {
    const allowed = pacedAllowance(DAILY, BURST, at(Math.min(seconds, 86399)));
    assert.ok(allowed >= previous, `allowance fell from ${previous} to ${allowed}`);
    previous = allowed;
  }
});

test("the first question of the day is not refused, which is the burst's job", () => {
  // Without a burst an evenly paced share is 0 at 00:00:01, refusing the first honest caller every day.
  assert.ok(pacedAllowance(DAILY, BURST, at(0)) >= 1);
});

test("midday has released a real share of the day, and not all of it", () => {
  const noon = pacedAllowance(DAILY, BURST, at(43200));
  assert.ok(noon > pacedAllowance(DAILY, BURST, at(3600)), `${noon} at noon is no more than at 1am`);
  assert.ok(noon < pacedAllowance(DAILY, BURST, at(82800)), `${noon} at noon is no less than at 11pm`);
  assert.ok(noon >= DAILY / 3 && noon <= (DAILY * 3) / 4, `${noon} of ${DAILY} at noon`);
});

test("Retry-After is minutes, not the rest of the day", () => {
  const wait = secondsPerPacedUnit(DAILY);
  assert.ok(wait > 0);
  assert.ok(wait <= 900, `${wait}s is most of an hour, which reads as "gone for today"`);
  assert.equal(wait, Math.round(86400 / DAILY));
});

test("secondsPerPacedUnit refuses to divide by zero", () => {
  assert.equal(secondsPerPacedUnit(0), 86400);
  assert.equal(secondsPerPacedUnit(-5), 86400);
});
