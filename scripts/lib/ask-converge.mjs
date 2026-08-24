/**
 * The Ask index convergence window ship waits out before declaring a miss.
 *
 * Split out of `ship.mjs` on exactly the footing `ci-status.mjs` is: the
 * DECISION is a pure loop over readings and can be driven by tests, while the
 * reading itself is a network call ship supplies. A poll loop that only exists
 * inside a deploy script is a poll loop nothing can exercise, and this repo has
 * already recorded the failure that hides there: "a poll loop that is a single
 * fetch wearing a loop", which breaks out on a not-yet-converged response and
 * defeats the wait it exists for.
 *
 * ## WHY THERE IS A WINDOW AT ALL
 *
 * `syncAsk` reads `expected` and `present` back IMMEDIATELY after its two
 * writes, and AI Search is eventually consistent, so the first reading can be
 * early rather than wrong. MEASURED 2026-08-24: ship read drift 1 at 02:20:18Z,
 * NO REMEDY WAS APPLIED, and the scheduled health check read ok 75 seconds
 * later and stayed ok.
 *
 * ## THE READING MUST BE READ-ONLY, AND THAT IS THE WHOLE DESIGN
 *
 * Polling by calling `sync_ask` again would re-upload the corpus, which repairs
 * the thing being measured, and a run that then converged could not be told
 * apart from one that had self-healed. That ambiguity is what the 2026-08-24
 * watch item recorded as unresolvable with the instruments then available.
 *
 * This module cannot enforce that its `reading` is read-only. What it does is
 * refuse to do the reading itself, so the choice is made at one visible call
 * site rather than buried in a loop.
 *
 * ## THE BOUND IS TWO INDEPENDENT LIMITS, DELIBERATELY
 *
 * No more than `attempts` iterations, AND no iteration begins once `windowMs`
 * has elapsed. A clock test alone would spin without limit if the clock never
 * advanced; a count alone would not honour the stated window if a reading hung.
 * Neither can be relieved by the other, so the loop terminates under both.
 *
 * The window can be exceeded only by the duration of the single reading already
 * in flight when the deadline passes, which is bounded by the caller's own
 * timeout on it.
 */

/** Polls, at most. Twelve at ten seconds each is the two-minute window. */
export const ASK_POLL_ATTEMPTS = 12;
/** Wait BEFORE each reading: the first one is pointless without a gap. */
export const ASK_POLL_INTERVAL_MS = 10_000;
/** The ruled window. No poll begins after this much has elapsed. */
export const ASK_POLL_WINDOW_MS = 120_000;

/**
 * Waits for a drift reading to report ok, or gives up at the bound.
 *
 * @param {object} options
 * @param {() => Promise<{ ok: boolean, expected?: number, present?: number } | null>} options.reading
 *   One read-only observation. Returning null, or throwing, counts as an
 *   unreadable poll and is neither convergence nor a miss: it consumes an
 *   attempt and the loop carries on.
 * @param {(ms: number) => Promise<unknown>} options.sleep
 * @param {() => number} [options.now]
 * @param {number} [options.attempts]
 * @param {number} [options.intervalMs]
 * @param {number} [options.windowMs]
 * @param {(event: { poll: number, reading: any }) => void} [options.onPoll]
 * @returns {Promise<{ converged: boolean, polls: number, latest: any }>}
 */
export async function awaitAskConvergence({
  reading,
  sleep,
  now = Date.now,
  attempts = ASK_POLL_ATTEMPTS,
  intervalMs = ASK_POLL_INTERVAL_MS,
  windowMs = ASK_POLL_WINDOW_MS,
  onPoll = () => {},
}) {
  const deadline = now() + windowMs;
  /** @type {any} */
  let latest = null;
  let polls = 0;

  for (let i = 0; i < attempts && now() < deadline; i += 1) {
    await sleep(intervalMs);
    polls += 1;

    /** @type {any} */
    let observed = null;
    try {
      observed = await reading();
    } catch {
      // An unreadable poll, same as a null. Health answering 503 is NOT this:
      // that is a readable answer about a failing check somewhere, and the
      // caller is expected to parse the body regardless of status.
      observed = null;
    }

    const usable = observed && typeof observed.ok === "boolean" ? observed : null;
    if (usable) latest = usable;
    onPoll({ poll: polls, reading: usable });

    // The one line the "single fetch wearing a loop" failure lives on: this
    // returns ONLY on ok. A not-yet-converged reading continues the loop.
    if (usable && usable.ok) return { converged: true, polls, latest };
  }

  return { converged: false, polls, latest };
}
