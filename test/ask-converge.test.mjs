import test from "node:test";
import assert from "node:assert/strict";

import {
  ASK_POLL_ATTEMPTS,
  ASK_POLL_INTERVAL_MS,
  ASK_POLL_WINDOW_MS,
  awaitAskConvergence,
} from "../scripts/lib/ask-converge.mjs";

/* Time moves only when the loop sleeps, so the two-minute deadline is tested without waiting. */
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

function readingAfter(
  misses,
  {
    expected = 99,
    present = 90,
    before = () => ({ name: "ask-index-drift", ok: false, expected, present }),
  } = {},
) {
  const state = { calls: 0 };
  return {
    state,
    reading: async () => {
      state.calls += 1;
      return state.calls > misses ? { name: "ask-index-drift", ok: true } : before();
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
  // Each bound is asserted with the other disabled: a bound only ever exercised alongside a
  // second one has not been shown to do anything.
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
  const { reading } = readingAfter(3, { before: () => null });

  const out = await awaitAskConvergence({ reading, sleep: clock.sleep, now: clock.now });
  assert.equal(out.converged, true);
  assert.equal(out.polls, 4);
});

test("a reading that throws is an unreadable poll, not a crash", async () => {
  const clock = fakeClock();
  const { reading } = readingAfter(1, {
    before: () => {
      throw new Error("ECONNRESET");
    },
  });

  const out = await awaitAskConvergence({ reading, sleep: clock.sleep, now: clock.now });
  assert.equal(out.converged, true);
  assert.equal(out.polls, 2);
});

test("a malformed reading is not mistaken for convergence", async () => {
  const clock = fakeClock();
  // `ok` absent entirely: a truthy object whose shape changed must not read as a pass.
  const reading = async () => ({ name: "ask-index-drift", status: "fine" });

  const out = await awaitAskConvergence({ reading, sleep: clock.sleep, now: clock.now });
  assert.equal(out.converged, false);
  assert.equal(out.latest, null);
});

test("a thrown read's reason reaches the poll callback and the result", async () => {
  const clock = fakeClock();
  /** @type {Array<string | null>} */
  const seen = [];
  const reading = async () => {
    throw new Error("ECONNRESET");
  };
  const out = await awaitAskConvergence({
    reading,
    sleep: clock.sleep,
    now: clock.now,
    onPoll: ({ error }) => seen.push(error),
  });
  assert.equal(out.converged, false);
  assert.equal(out.lastError, "ECONNRESET");
  assert.ok(seen.length > 0 && seen.every((e) => e === "ECONNRESET"));
});
