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
 * @param {(event: { poll: number, reading: any, error: string | null }) => void} [options.onPoll]
 * @returns {Promise<{ converged: boolean, polls: number, latest: any, lastError: string | null }>}
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
  /** A thrown read is an unreadable poll, and its reason is carried out rather than dropped. */
  /** @type {string | null} */
  let lastError = null;

  for (let i = 0; i < attempts && now() < deadline; i += 1) {
    await sleep(intervalMs);
    polls += 1;

    /** @type {any} */
    let observed = null;
    /** @type {string | null} */
    let error = null;
    try {
      observed = await reading();
    } catch (thrown) {
      // A failing HTTP status is not this: it is a readable answer, and the caller parses the body.
      error = thrown instanceof Error ? thrown.message : String(thrown);
      lastError = error;
    }

    const usable = observed && typeof observed.ok === "boolean" ? observed : null;
    if (usable) latest = usable;
    onPoll({ poll: polls, reading: usable, error });

    if (usable && usable.ok) return { converged: true, polls, latest, lastError };
  }

  return { converged: false, polls, latest, lastError };
}

/**
 * Ship's post-repair assertion reads health seconds after the Ask upload, and the index can list
 * short then even when the upload's own write-back read was full (157 then 155, deploy run
 * 36274700184). A failing row gets the same bounded window as the write-back; one that converges
 * is ok, and one that does not keeps its latest counts and the time waited, for the miss.
 *
 * @param {object} options
 * @param {import("./readiness.mjs").HealthCheckRow | undefined} options.row the ask-index-drift row
 * @param {() => Promise<{ ok: boolean, expected?: number, present?: number } | null>} options.reading
 * @param {(ms: number) => Promise<unknown>} options.sleep
 * @param {() => number} [options.now]
 * @param {(event: { poll: number, reading: any, error: string | null }) => void} [options.onPoll]
 * @returns {Promise<import("./readiness.mjs").HealthCheckRow | undefined>}
 */
export async function settleAskDrift({ row, reading, sleep, now = Date.now, onPoll }) {
  if (!row || row.ok === true) return row;

  const started = now();
  const { converged, latest } = await awaitAskConvergence({ reading, sleep, now, onPoll });
  // The row's own counts are the stale ones; a converged row carries none, as health's ok rows do.
  if (converged) return { name: row.name, ok: true };
  const counts =
    latest && typeof latest.expected === "number" && typeof latest.present === "number"
      ? { expected: latest.expected, present: latest.present }
      : {};
  return { ...row, ...counts, waitedMs: now() - started };
}
