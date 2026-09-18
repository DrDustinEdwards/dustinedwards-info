/**
 * The Ask index convergence window ship waits out before declaring a miss.
 *
 * BOUNDARY: the DECISION only, a pure loop over readings, while the reading itself is a network
 * call ship supplies. This cannot enforce that the reading is read-only; what it does is refuse to
 * do the reading itself, so that choice is made at one visible call site.
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
      // An unreadable poll, same as a null. A failing status is NOT this: that is a readable answer
      // about a failing check somewhere, and the caller parses the body regardless of status.
      observed = null;
    }

    const usable = observed && typeof observed.ok === "boolean" ? observed : null;
    if (usable) latest = usable;
    onPoll({ poll: polls, reading: usable });

    // The one line the "single fetch wearing a loop" failure lives on: this returns ONLY on ok, and a
    // not-yet-converged reading continues the loop.
    if (usable && usable.ok) return { converged: true, polls, latest };
  }

  return { converged: false, polls, latest };
}
