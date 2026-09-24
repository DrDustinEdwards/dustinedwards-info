/**
 * Pacing the Ask daily ceiling.
 *
 * REPLAYS THE FINDING, per the replay rule. The 2026-08-22 audit, section 27: "A
 * distributed caller could exhaust the daily cap for $0 and deny the feature to
 * everyone." Verified TRUE in substance against the code on 2026-08-23, and
 * the audit's stated per-IP number is WRONG: it says 6/min, `ASK_RATE_LIMIT` is
 * 5. The 200/day is correct.
 *
 * The scenario asserted below is that audit sentence made concrete: 200 units
 * spent in the first minutes of a UTC day, under a flat cap, leaves the rest of
 * the day dead. Paced, it cannot.
 *
 * @see app/lib/search/ask-pacing.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import { pacedAllowance, secondsPerPacedUnit } from "../app/lib/search/ask-pacing.mjs";

const DAILY = 200;
const BURST = 25;

/** A UTC instant that many seconds into 2026-08-23. */
const at = (seconds) => new Date(Date.UTC(2026, 7, 23, 0, 0, 0) + seconds * 1000);

test("THE DEFECT: a burst at midnight cannot take the whole day", () => {
  // Under the flat cap this is exactly what the audit describes: 200 units are
  // available at 00:00:01, so a distributed caller takes all of them and every
  // reader for the next 23 hours is refused.
  const atOpening = pacedAllowance(DAILY, BURST, at(1));
  assert.ok(
    atOpening < DAILY,
    `${atOpening} of ${DAILY} available one second into the day: the cliff is intact`,
  );
  assert.equal(atOpening, BURST, "one second in, the allowance is exactly the burst");
});

test("the day still recovers continuously after such a burst", () => {
  // The property that makes this degrade rather than die: having taken the
  // burst, the attacker has NOT bought the rest of the day. An hour later there
  // is more allowance than they consumed.
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
  // And by the end of the day the whole budget has been released, so pacing
  // never costs the site answers it was willing to pay for.
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
  // Without a burst an evenly paced share is 0 at 00:00:01 and the endpoint
  // would refuse its first honest caller every single day. That would be a
  // worse bug than the one being fixed.
  assert.ok(pacedAllowance(DAILY, BURST, at(0)) >= 1);
});

test("midday releases about half the day, plus the burst", () => {
  const noon = pacedAllowance(DAILY, BURST, at(43200));
  assert.equal(noon, DAILY / 2 + BURST);
});

test("Retry-After is minutes, not the rest of the day", () => {
  // The whole point of the change: telling a reader to come back tomorrow when
  // budget frees up every few minutes sends them away permanently.
  const wait = secondsPerPacedUnit(DAILY);
  assert.ok(wait > 0);
  assert.ok(wait <= 900, `${wait}s is most of an hour, which reads as "gone for today"`);
  assert.equal(wait, Math.round(86400 / DAILY));
});

test("secondsPerPacedUnit refuses to divide by zero", () => {
  assert.equal(secondsPerPacedUnit(0), 86400);
  assert.equal(secondsPerPacedUnit(-5), 86400);
});
