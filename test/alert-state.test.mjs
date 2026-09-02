/**
 * Whether a watchdog firing mails, given what the last one saw.
 *
 * REPLAYS THE DEFECT, per hard rule 12. The defect is not a wrong verdict; it
 * is that the handler was STATELESS, so one condition red for an afternoon
 * produced 27 identical emails at four an hour. The replay is therefore a
 * SEQUENCE rather than a single call: red, red, green, asserting one mail, then
 * none, then one. A test that only checked a single transition would pass
 * against the old code on the first poll.
 *
 * The end-to-end replay against the real deployed cron is separate and is what
 * proves the wiring; this covers the decision, which is the half a scheduled
 * handler makes unobservable.
 *
 * @see app/lib/health/alert-state.mjs
 * @see workers/watchdog.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import { alertTransition, formatDuration } from "../app/lib/health/alert-state.mjs";

const T0 = "2026-09-02T10:00:00.000Z";
const T1 = "2026-09-02T10:15:00.000Z";
const T2 = "2026-09-02T10:30:00.000Z";
const T3 = "2026-09-02T13:45:00.000Z";

const green = { red: false, since: T0, checks: [] };

/* ---- THE REPLAY: the 27-email sequence, as a sequence -------------------- */

test("PLANT: red, red, green mails exactly once, never, once", () => {
  // Poll 1: healthy state stored, now unhealthy. One mail.
  const first = alertTransition({
    stored: green,
    alerting: true,
    failing: ["fts-equality"],
    now: T1,
  });
  assert.equal(first.email?.kind, "opened", "going red must mail");
  assert.deepEqual(first.email?.checks, ["fts-equality"], "the mail names what changed");
  assert.equal(first.state.red, true);
  assert.equal(first.state.since, T1, "the clock starts when it went red");

  // Poll 2: still unhealthy. NO mail. This is the whole defect.
  const second = alertTransition({
    stored: first.state,
    alerting: true,
    failing: ["fts-equality"],
    now: T2,
  });
  assert.equal(second.email, null, "a second red poll must NOT mail");
  assert.equal(second.write, false, "and with nothing changed there is nothing to store");
  assert.equal(second.state.since, T1, "the episode keeps its original start");

  // Poll 3: recovered. One mail, carrying the duration.
  const third = alertTransition({
    stored: second.state,
    alerting: false,
    failing: [],
    now: T3,
  });
  assert.equal(third.email?.kind, "recovered", "coming back must mail");
  assert.deepEqual(third.email?.checks, ["fts-equality"], "recovery names what HAD been failing");
  assert.equal(third.email?.durationMs, 3 * 60 * 60 * 1000 + 30 * 60 * 1000);
  assert.equal(third.state.red, false);
});

test("a long red spell mails once however many polls it takes", () => {
  // The measured shape: four polls an hour for an afternoon.
  let state = green;
  let mails = 0;
  for (let i = 0; i < 28; i += 1) {
    const step = alertTransition({
      stored: state,
      alerting: true,
      failing: ["fts-equality"],
      now: new Date(Date.parse(T0) + i * 15 * 60 * 1000).toISOString(),
    });
    if (step.email) mails += 1;
    state = step.state;
  }
  assert.equal(mails, 1, "28 red polls is one alert, not 28");
});

/* ---- the baseline, which must not fire on a deploy ----------------------- */

test("NO STORED STATE IS A BASELINE, not a change, even when red", () => {
  // A fresh deploy landing during a red spell must not mail. It has never seen
  // a previous state, and "I have not looked before" is not "it just broke".
  const out = alertTransition({ stored: null, alerting: true, failing: ["fts-equality"], now: T1 });
  assert.equal(out.email, null);
  assert.equal(out.write, true, "but it must record what it saw");
  assert.equal(out.state.red, true);
  assert.match(out.reason, /baseline/);
});

test("a baseline recorded red still mails when it recovers", () => {
  const base = alertTransition({ stored: null, alerting: true, failing: ["x"], now: T1 });
  const back = alertTransition({ stored: base.state, alerting: false, failing: [], now: T2 });
  assert.equal(back.email?.kind, "recovered");
});

test("garbage in the store is treated as absent, never coerced", () => {
  // A half-parsed record would produce a duration measured from a timestamp
  // nobody wrote.
  for (const junk of [7, "red", {}, { red: "yes", since: T0 }, { red: true }, { since: T0 }]) {
    const out = alertTransition({ stored: junk, alerting: true, failing: ["x"], now: T1 });
    assert.equal(out.email, null, `${JSON.stringify(junk)} must be a baseline`);
    assert.match(out.reason, /baseline/);
  }
});

/* ---- unreadable is NOT absent ------------------------------------------- */

test("AN UNREADABLE STORE MAILS RATHER THAN GOING QUIET", () => {
  // Absent means first run. Unreadable means the dedupe is blind, and a blind
  // dedupe that stays silent is a monitor that quietly stopped monitoring.
  const out = alertTransition({
    stored: null,
    storedReadable: false,
    alerting: true,
    failing: ["fts-equality"],
    now: T1,
  });
  assert.equal(out.email?.kind, "opened");
  assert.match(out.reason, /could not be read/);
});

test("an unreadable store on a HEALTHY poll still mails nothing", () => {
  const out = alertTransition({
    stored: null,
    storedReadable: false,
    alerting: false,
    failing: [],
    now: T1,
  });
  assert.equal(out.email, null, "nothing is wrong, so there is nothing to say");
  assert.equal(out.write, true);
});

/* ---- the failing set while red ------------------------------------------ */

test("a new check joining an existing outage is recorded, not mailed", () => {
  const red = alertTransition({ stored: green, alerting: true, failing: ["a"], now: T1 });
  const wider = alertTransition({
    stored: red.state,
    alerting: true,
    failing: ["a", "b"],
    now: T2,
  });
  assert.equal(wider.email, null, "still one outage");
  assert.equal(wider.write, true, "but the wider set is stored");
  assert.deepEqual(wider.state.checks, ["a", "b"]);

  const back = alertTransition({ stored: wider.state, alerting: false, failing: [], now: T3 });
  assert.deepEqual(back.email?.checks, ["a", "b"], "recovery names everything that broke");
});

test("names are normalised, so ordering cannot cause a spurious write", () => {
  const red = alertTransition({ stored: green, alerting: true, failing: ["b", "a"], now: T1 });
  const same = alertTransition({
    stored: red.state,
    alerting: true,
    failing: ["a", "b", "a"],
    now: T2,
  });
  assert.equal(same.write, false, "the same set in a different order is not a change");
});

test("healthy to healthy writes nothing at all", () => {
  const out = alertTransition({ stored: green, alerting: false, failing: [], now: T1 });
  assert.equal(out.email, null);
  assert.equal(out.write, false);
});

/* ---- duration ------------------------------------------------------------ */

test("an unparseable since yields NO duration rather than zero", () => {
  // "recovered after 0 seconds" reads as a measurement and is not one.
  const out = alertTransition({
    stored: { red: true, since: "not a date", checks: ["x"] },
    alerting: false,
    failing: [],
    now: T1,
  });
  assert.equal(out.email?.durationMs, null);
  assert.equal(formatDuration(null), "an unknown time");
});

test("formatDuration keeps to two units", () => {
  assert.equal(formatDuration(45 * 1000), "45s");
  assert.equal(formatDuration(90 * 1000), "1m");
  assert.equal(formatDuration(3 * 60 * 60 * 1000), "3h");
  assert.equal(formatDuration(3 * 60 * 60 * 1000 + 30 * 60 * 1000), "3h 30m");
  assert.equal(formatDuration(50 * 60 * 60 * 1000), "2d 2h");
  assert.equal(formatDuration(-1), "an unknown time");
});

test("a clock that went backwards is unknown, not negative", () => {
  const out = alertTransition({
    stored: { red: true, since: T3, checks: ["x"] },
    alerting: false,
    failing: [],
    now: T0,
  });
  assert.equal(out.email?.durationMs, null);
});
