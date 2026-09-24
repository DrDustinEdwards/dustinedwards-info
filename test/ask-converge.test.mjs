/**
 * The Ask convergence window ship waits out before declaring a miss.
 *
 * REPLAYS THE FINDING, per the replay rule. Ruled 2026-08-24 from a measured false
 * alarm: ship read drift 1 at 02:20:18Z, no remedy was applied, and health read
 * ok 75 seconds later and stayed ok. The write-back read was early, not wrong.
 *
 * These drive the loop with an injected clock, sleep and reading, so the two
 * minute window costs nothing to test and the BOUND is asserted rather than
 * assumed. A poll loop that only runs inside a deploy script is a poll loop
 * nothing exercises, and this repo already records what hides there: "a poll
 * loop that is a single fetch wearing a loop", which breaks out on a
 * not-yet-converged response and defeats the wait it exists for. The
 * `stops on ok, and only on ok` pair below is the assertion for exactly that.
 *
 * @see scripts/lib/ask-converge.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ASK_POLL_ATTEMPTS,
  ASK_POLL_INTERVAL_MS,
  ASK_POLL_WINDOW_MS,
  awaitAskConvergence,
} from "../scripts/lib/ask-converge.mjs";

/**
 * A fake clock that only advances when the loop sleeps, so the loop's own
 * waiting is what moves time. A test that used the real clock would either take
 * two minutes or prove nothing about the deadline.
 */
function fakeClock() {
  const state = { t: 1_000_000, slept: [] };
  return {
    now: () => state.t,
    sleep: async (ms) => {
      state.slept.push(ms);
      state.t += ms;
    },
    state,
  };
}

/** A reading that reports not-ok `misses` times, then ok forever. */
function readingAfter(misses, { expected = 99, present = 90 } = {}) {
  const state = { calls: 0 };
  return {
    state,
    reading: async () => {
      state.calls += 1;
      return state.calls > misses
        ? { name: "ask-index-drift", ok: true }
        : { name: "ask-index-drift", ok: false, expected, present };
    },
  };
}

test("converges on the first poll when the index has already caught up", async () => {
  const clock = fakeClock();
  const { reading } = readingAfter(0);
  const out = await awaitAskConvergence({ reading, sleep: clock.sleep, now: clock.now });

  assert.equal(out.converged, true);
  assert.equal(out.polls, 1);
  // It still waited once before reading. Reading immediately would ask the same
  // question syncAsk just asked and get the same stale answer.
  assert.deepEqual(clock.state.slept, [ASK_POLL_INTERVAL_MS]);
});

test("keeps polling through not-yet-converged readings and reports the count", async () => {
  const clock = fakeClock();
  const { reading } = readingAfter(4);
  const out = await awaitAskConvergence({ reading, sleep: clock.sleep, now: clock.now });

  assert.equal(out.converged, true);
  assert.equal(out.polls, 5);
});

test("a permanent miss stays a miss, and carries the latest counts", async () => {
  const clock = fakeClock();
  const { reading, state } = readingAfter(Infinity, { expected: 99, present: 90 });
  const out = await awaitAskConvergence({ reading, sleep: clock.sleep, now: clock.now });

  assert.equal(out.converged, false);
  // The miss is reported with what the LAST reading said, not with the stale
  // write-back pair the window was opened to outlive.
  assert.equal(out.latest.expected, 99);
  assert.equal(out.latest.present, 90);
  assert.ok(state.calls > 1, "a permanent miss must have been read more than once");
});

test("THE BOUND: a permanent miss stops at the attempt limit", async () => {
  const clock = fakeClock();
  const { reading, state } = readingAfter(Infinity);
  const out = await awaitAskConvergence({ reading, sleep: clock.sleep, now: clock.now });

  assert.equal(out.polls, ASK_POLL_ATTEMPTS);
  assert.equal(state.calls, ASK_POLL_ATTEMPTS);
});

test("THE BOUND: no poll begins after the window has elapsed", async () => {
  const clock = fakeClock();
  const start = clock.now();
  const { reading } = readingAfter(Infinity);
  // An attempt limit far above what the window allows, so the DEADLINE is the
  // only thing that can stop this. Without it the loop would run 10,000 times.
  const out = await awaitAskConvergence({
    reading,
    sleep: clock.sleep,
    now: clock.now,
    attempts: 10_000,
  });

  assert.equal(out.converged, false);
  assert.equal(out.polls, ASK_POLL_WINDOW_MS / ASK_POLL_INTERVAL_MS);
  assert.ok(
    clock.now() - start <= ASK_POLL_WINDOW_MS,
    `slept ${clock.now() - start}ms, which is past the ${ASK_POLL_WINDOW_MS}ms window`,
  );
});

test("THE BOUND: a clock that never advances still terminates", async () => {
  // The mirror of the test above: here the deadline can never be reached, so
  // the attempt limit is the only thing that can stop the loop. Each bound is
  // asserted with the other one disabled, because a bound that is only ever
  // exercised alongside a second one has not been shown to do anything.
  const { reading, state } = readingAfter(Infinity);
  const out = await awaitAskConvergence({
    reading,
    sleep: async () => {},
    now: () => 1_000_000,
  });

  assert.equal(out.converged, false);
  assert.equal(state.calls, ASK_POLL_ATTEMPTS);
});

test("an unreadable poll is neither convergence nor a miss", async () => {
  const clock = fakeClock();
  const state = { calls: 0 };
  const reading = async () => {
    state.calls += 1;
    if (state.calls <= 3) return null;
    return { name: "ask-index-drift", ok: true };
  };

  const out = await awaitAskConvergence({ reading, sleep: clock.sleep, now: clock.now });
  assert.equal(out.converged, true);
  assert.equal(out.polls, 4);
});

test("a reading that throws is an unreadable poll, not a crash", async () => {
  const clock = fakeClock();
  const state = { calls: 0 };
  const reading = async () => {
    state.calls += 1;
    if (state.calls === 1) throw new Error("ECONNRESET");
    return { name: "ask-index-drift", ok: true };
  };

  const out = await awaitAskConvergence({ reading, sleep: clock.sleep, now: clock.now });
  assert.equal(out.converged, true);
  assert.equal(out.polls, 2);
});

test("a malformed reading is not mistaken for convergence", async () => {
  const clock = fakeClock();
  // `ok` absent entirely. A truthy object whose shape changed must not read as
  // a pass: that is the shape of every silent-pass defect in this repo.
  const reading = async () => ({ name: "ask-index-drift", status: "fine" });

  const out = await awaitAskConvergence({ reading, sleep: clock.sleep, now: clock.now });
  assert.equal(out.converged, false);
  assert.equal(out.latest, null);
});

test("onPoll reports every poll, readable or not, in order", async () => {
  const clock = fakeClock();
  const state = { calls: 0 };
  const reading = async () => {
    state.calls += 1;
    if (state.calls === 1) return null;
    if (state.calls === 2) return { name: "ask-index-drift", ok: false, expected: 9, present: 8 };
    return { name: "ask-index-drift", ok: true };
  };

  /** @type {any[]} */
  const seen = [];
  await awaitAskConvergence({
    reading,
    sleep: clock.sleep,
    now: clock.now,
    onPoll: (event) => seen.push(event),
  });

  assert.equal(seen.length, 3);
  assert.deepEqual(
    seen.map((e) => [e.poll, e.reading === null ? "unreadable" : e.reading.ok]),
    [
      [1, "unreadable"],
      [2, false],
      [3, true],
    ],
  );
});
