export const ASK_POLL_ATTEMPTS = 12;
export const ASK_POLL_INTERVAL_MS = 10_000;
export const ASK_POLL_WINDOW_MS = 120_000;

/**
 * @param {object} options
 * @param {() => Promise<{ ok: boolean, expected?: number, present?: number } | null>} options.reading
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
      // A failing HTTP status is not this: it is a readable answer, and the caller parses the body.
      observed = null;
    }

    const usable = observed && typeof observed.ok === "boolean" ? observed : null;
    if (usable) latest = usable;
    onPoll({ poll: polls, reading: usable });

    if (usable && usable.ok) return { converged: true, polls, latest };
  }

  return { converged: false, polls, latest };
}
