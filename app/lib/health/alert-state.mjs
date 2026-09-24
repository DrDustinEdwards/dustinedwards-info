// Mails only on a change of state. Absent state is a baseline and mails nothing; UNREADABLE state
// mails if red, since a blind dedupe that stays silent has quietly stopped monitoring.

/** @param {unknown} list @returns {string[]} sorted, unique, strings only */
function names(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((n) => typeof n === "string" && n.length > 0))].sort();
}

/** @param {string[]} a @param {string[]} b @returns {boolean} */
function sameNames(a, b) {
  return a.length === b.length && a.every((n, i) => n === b[i]);
}

/**
 * Anything else is absent, not coerced: a half-parsed record would time a duration from nothing.
 *
 * @param {unknown} value
 * @returns {{ red: boolean, since: string, checks: string[] } | null}
 */
function readStored(value) {
  if (!value || typeof value !== "object") return null;
  const record = /** @type {any} */ (value);
  if (typeof record.red !== "boolean") return null;
  if (typeof record.since !== "string" || record.since.length === 0) return null;
  return { red: record.red, since: record.since, checks: names(record.checks) };
}

/**
 * Null, not zero, when unknown: "recovered after 0 seconds" reads as a measurement and is not one.
 *
 * @param {string} since @param {string} now
 */
function elapsed(since, now) {
  const a = Date.parse(since);
  const b = Date.parse(now);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return b - a;
}

/**
 * @param {number | null} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return "an unknown time";
  const total = Math.floor(ms / 1000);
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) return restMinutes > 0 ? `${hours}h ${restMinutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours > 0 ? `${days}d ${restHours}h` : `${days}d`;
}

/**
 * @param {object} input
 * @param {unknown} input.stored       what KV held, or null when the key is absent
 * @param {boolean} input.storedReadable  false when the read itself FAILED
 * @param {boolean} input.alerting     this firing ended in an alert condition
 * @param {string[]} input.failing     check names failing now
 * @param {string} input.now           ISO timestamp, supplied so tests can hold time
 * @returns {{
 *   email: null | { kind: "opened" | "recovered", checks: string[], durationMs: number | null },
 *   state: { red: boolean, since: string, checks: string[] },
 *   write: boolean,
 *   reason: string,
 * }}
 */
export function alertTransition({ stored, storedReadable = true, alerting, failing, now }) {
  const current = names(failing);

  if (!storedReadable) {
    return {
      email: alerting ? { kind: "opened", checks: current, durationMs: null } : null,
      state: { red: alerting, since: now, checks: alerting ? current : [] },
      write: true,
      reason: alerting
        ? "the stored state could not be read, so this mails rather than risk silence"
        : "the stored state could not be read; nothing is wrong, so the baseline is rewritten",
    };
  }

  const previous = readStored(stored);

  if (previous === null) {
    return {
      email: null,
      state: { red: alerting, since: now, checks: alerting ? current : [] },
      write: true,
      reason: "no usable stored state: this poll is the baseline and mails nothing",
    };
  }

  if (!previous.red && alerting) {
    return {
      email: { kind: "opened", checks: current, durationMs: null },
      state: { red: true, since: now, checks: current },
      write: true,
      reason: "healthy to unhealthy",
    };
  }

  if (previous.red && !alerting) {
    return {
      email: {
        kind: "recovered",
        checks: previous.checks,
        durationMs: elapsed(previous.since, now),
      },
      state: { red: false, since: now, checks: [] },
      write: true,
      reason: "unhealthy to healthy",
    };
  }

  if (previous.red && alerting) {
    const union = names([...previous.checks, ...current]);
    const grew = !sameNames(union, previous.checks);
    return {
      email: null,
      state: { red: true, since: previous.since, checks: union },
      write: grew,
      reason: grew
        ? "still unhealthy, and the failing set grew; recorded, not mailed"
        : "still unhealthy; suppressed",
    };
  }

  return {
    email: null,
    state: previous,
    write: false,
    reason: "still healthy",
  };
}
