// `converged` is DERIVED from counts read back after the writes, never asserted by the caller: `ship`
// fails on it, and a run's own counters would report a healthy number over a wrong index.

/**
 * The Ask index after a sync has ended: one item per row of its query, so the counts are the read-back. A sync that
 * had not ended inside the wait, or a row the index refused, makes `converged` false even when the counts agree.
 *
 * @param {{
 *   job: string,
 *   ended: boolean,
 *   expected: number,
 *   present: number,
 *   refused: number,
 *   indexing: number,
 * }} counts
 * @returns {{
 *   job: string,
 *   ended: boolean,
 *   expected: number,
 *   present: number,
 *   drift: number,
 *   refused: number,
 *   indexing: number,
 *   converged: boolean,
 * }}
 */
export function askSyncReport(counts) {
  const agreement = convergence(counts.expected, counts.present);
  const refused = whole(counts.refused);
  return {
    job: String(counts.job),
    ended: counts.ended === true,
    ...agreement,
    refused,
    indexing: whole(counts.indexing),
    converged:
      agreement.converged &&
      counts.ended === true &&
      Number.isInteger(counts.refused) &&
      refused === 0,
  };
}

/**
 * ABSOLUTE drift: an index holding more than its source is stale too, and a negative number would read
 * as healthy to a caller testing `drift > 0`.
 *
 *
 * @param {unknown} expectedRaw @param {unknown} presentRaw
 * @returns {{ expected: number, present: number, drift: number, converged: boolean }}
 */
function convergence(expectedRaw, presentRaw) {
  const expected = whole(expectedRaw);
  const present = whole(presentRaw);
  const drift = Math.abs(expected - present);
  return {
    expected,
    present,
    drift,
    converged: unreadable(expectedRaw, presentRaw) ? false : drift === 0,
  };
}

/**
 * Media drifts by KEY: dropping one file while inventing one row leaves the totals equal, so drift is
 * `missing` plus `extra`, not a count difference.
 *
 *
 * @param {{
 *   indexed: number,
 *   removed: number,
 *   failures: string[],
 *   expected: number,
 *   present: number,
 *   missing: string[],
 *   extra: string[],
 * }} counts
 */
export function mediaSyncReport(counts) {
  const totals = convergence(counts.expected, counts.present);
  const missing = list(counts.missing);
  const extra = list(counts.extra);
  const drift = missing.length + extra.length;
  const failures = list(counts.failures);
  // Fails closed: a list that is not an array of strings cannot say what is missing or what failed, so
  // the report does not converge on it.
  const readable = [counts.missing, counts.extra, counts.failures].every(stringList);

  return {
    indexed: whole(counts.indexed),
    removed: whole(counts.removed),
    expected: totals.expected,
    present: totals.present,
    drift,
    missing,
    extra,
    failures,
    // A failed derivation leaves no row and no source change, so the key sets can agree while wrong.
    converged: totals.converged && readable && drift === 0 && failures.length === 0,
    unreadable: !readable,
  };
}

/** @param {unknown} v @returns {string[]} */
function list(v) {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

/** @param {unknown} v @returns {boolean} */
function stringList(v) {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

/**
 * @param {ReturnType<typeof mediaSyncReport>} report
 * @returns {string}
 */
export function mediaSyncSummary(report) {
  if (report.converged) {
    return (
      `Site file index converged: ${report.expected} expected, ${report.present} present, ` +
      `${report.indexed} indexed, ${report.removed} removed.`
    );
  }
  const why = [
    report.missing.length ? `${report.missing.length} missing` : "",
    report.extra.length ? `${report.extra.length} extra` : "",
    report.failures.length ? `${report.failures.length} failed to derive` : "",
    report.unreadable ? "an unreadable missing, extra or failure list" : "",
  ].filter(Boolean);
  return (
    `MEDIA INDEX STILL DRIFTED: ${report.expected} expected, ${report.present} present` +
    (why.length ? ` (${why.join(", ")})` : "") +
    `, after indexing ${report.indexed} and removing ${report.removed}.`
  );
}

/**
 * An unreadable count is not a passing count.
 *
 * @param {unknown} a @param {unknown} b
 */
function unreadable(a, b) {
  return !Number.isInteger(a) || !Number.isInteger(b);
}

/** @param {unknown} n @returns {number} */
function whole(n) {
  return Number.isInteger(n) ? Number(n) : 0;
}
