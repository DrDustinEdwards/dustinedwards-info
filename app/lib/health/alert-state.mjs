/**
 * WHETHER THIS FIRING SHOULD MAIL, given what the last one saw.
 *
 * ## The defect
 *
 * `workers/watchdog.ts` was stateless: it re-derived everything from one
 * reading and mailed whenever that reading was bad. The cron fires every
 * fifteen minutes, so ONE condition that stayed red for an afternoon produced
 * 27 emails, four an hour, every one of them the same sentence. An alert that
 * repeats itself trains its reader to filter it, which costs the next real
 * alert its only job.
 *
 * ## The rule
 *
 * Mail on a CHANGE OF STATE. Once when it goes red, once when it comes back.
 * Nothing while it stays red, however many polls that takes.
 *
 * ## WHY THIS IS A MODULE AND NOT A BRANCH IN THE HANDLER
 *
 * The same reason `repair.mjs` is: the handler runs on a schedule, only when
 * something is already broken, and is the least observable code in this
 * repository. A decision about whether a human is woken must be exercisable by
 * `check:tests`, so the decision lives here and the Worker does the I/O.
 *
 * DEPENDENCY-FREE, and it NEVER fetches, reads a clock or touches KV. `now` is
 * an argument precisely so a test can hold time still.
 *
 * ## THE THREE CASES THAT ARE NOT A TRANSITION
 *
 * 1. **No stored state is a BASELINE, not a change.** A fresh deploy, a new KV
 *    namespace or a first-ever run has nothing to compare against, and the
 *    honest reading of "I have never seen this before" is not "it just broke".
 *    It records what it saw and mails nothing. Named in the ruling because the
 *    alternative fires an alert on every deploy that lands during a red spell.
 *
 * 2. **State that could not be READ is different from state that is ABSENT**,
 *    and they must not collapse. Absent means first run; unreadable means the
 *    dedupe is blind. A blind dedupe that stays silent is a monitor that has
 *    quietly stopped monitoring, which is this repo's most-repeated failure
 *    shape. So an unreadable store MAILS if the site is red, and says why.
 *
 * 3. **Red to red is not silence about a changed failure set.** The set is
 *    accumulated so the recovery mail can name everything that broke during the
 *    episode rather than only what broke first, but a new check joining an
 *    existing outage is still one outage and does not re-mail.
 */

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
 * A stored state that this module is willing to believe.
 *
 * Anything else is treated as absent rather than coerced: a half-parsed record
 * would produce a duration measured from a timestamp nobody wrote.
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
 * How long an episode lasted, in milliseconds, or null if it cannot be known.
 *
 * NULL IS A REAL ANSWER. An unparseable `since` yields no duration rather than
 * a zero, because "recovered after 0 seconds" is a sentence that reads as a
 * measurement and is not one.
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
 * A duration a person reads at 2am. Largest two units, never more.
 *
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
 * The decision.
 *
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
