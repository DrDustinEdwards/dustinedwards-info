// `converged` is DERIVED from counts read back after the writes, never asserted by the caller: `ship`
// fails on it, and a loop over a wrongly built corpus still reports a healthy `uploaded`.

/**
 * Any failed key makes `converged` false, even when the counts happen to agree.
 *
 * @param {{
 *   uploaded: number,
 *   removed: number,
 *   cacheDropped: number,
 *   expected: number,
 *   present: number,
 *   failed?: Array<{ key: string, error: string }>,
 * }} counts
 * @returns {{
 *   uploaded: number,
 *   removed: number,
 *   cacheDropped: number,
 *   expected: number,
 *   present: number,
 *   drift: number,
 *   converged: boolean,
 *   failed: Array<{ key: string, error: string }>,
 *   unreadable: boolean,
 * }}
 */
export function askSyncReport(counts) {
  const agreement = convergence(counts.expected, counts.present);
  // An absent list means the caller had nothing to report; anything else that is not an array is an
  // unreadable failure list, and a report that cannot say what failed has not converged.
  const failedReadable = counts.failed === undefined || Array.isArray(counts.failed);
  const failed = Array.isArray(counts.failed) ? counts.failed : [];
  return {
    uploaded: whole(counts.uploaded),
    removed: whole(counts.removed),
    cacheDropped: whole(counts.cacheDropped),
    ...agreement,
    converged: agreement.converged && failedReadable && failed.length === 0,
    failed,
    unreadable: !failedReadable,
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
      `Media index converged: ${report.expected} expected, ${report.present} present, ` +
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

/**
 * @param {ReturnType<typeof askSyncReport>} report
 * @returns {string}
 */
export function askSyncSummary(report) {
  if (report.failed?.length) {
    return (
      `ASK UPLOAD FAILED for ${report.failed.length} key(s) after retries: ` +
      `${report.failed.map((f) => `${f.key} (${f.error})`).join(", ")}. ` +
      `${report.expected} expected, ${report.present} present.`
    );
  }
  if (report.unreadable) {
    return (
      `ASK SYNC REPORT UNREADABLE: the failure list was not a list, so what failed is unknown. ` +
      `${report.expected} expected, ${report.present} present.`
    );
  }
  return report.converged
    ? `Ask index converged: ${report.expected} expected, ${report.present} present, ` +
        `${report.uploaded} uploaded, ${report.removed} removed.`
    : `ASK INDEX STILL SHORT: ${report.expected} expected, ${report.present} present, ` +
        `drift ${report.drift}, after uploading ${report.uploaded} and removing ${report.removed}.`;
}
