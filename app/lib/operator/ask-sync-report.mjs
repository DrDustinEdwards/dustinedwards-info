/**
 * WHAT A sync_ask CALL REPORTS, AND WHEN IT COUNTS AS DONE.
 *
 * ## Why this is a module and not three lines in the tool
 *
 * The whole value of the operation is the pair of counts it returns AFTER the
 * upload, and the only interesting question is whether they agree. That
 * question is pure arithmetic over four integers, so it can be driven by
 * `check:tests` without an AI Search binding, a D1 database or a deploy.
 *
 * ## THE CLASS THIS CLOSES
 *
 * `ship` runs this and fails the run when it does not converge. An operation
 * that answered "ok" by virtue of having been CALLED, rather than by virtue of
 * the index agreeing afterwards, would turn that into a green light that means
 * nothing: the deploy would land, ship would say shipped, and the Ask index
 * would still be short. That is the shape the health alert already caught once
 * by hand, and reporting an unverified success is how it would stop catching it.
 *
 * So `converged` is DERIVED from the counts, never asserted by the caller.
 *
 * ## WHY THE COUNTS ARE READ AFTER, NOT ACCUMULATED DURING
 *
 * `uploaded` is what the upload loop THINKS it wrote. `expected` and `present`
 * are read back from D1 and from AI Search once the writes are done. A loop
 * that ran cleanly over a corpus it had built wrongly reports a healthy
 * `uploaded` and a short `present`, and only the read-back can tell.
 *
 * @see test/ask-sync-report.test.mjs
 * @see app/lib/operator/api.server.ts
 */

/**
 * The report body for one sync_ask call.
 *
 * @param {{
 *   uploaded: number,
 *   removed: number,
 *   cacheDropped: number,
 *   expected: number,
 *   present: number,
 * }} counts
 * @returns {{
 *   uploaded: number,
 *   removed: number,
 *   cacheDropped: number,
 *   expected: number,
 *   present: number,
 *   drift: number,
 *   converged: boolean,
 * }}
 */
export function askSyncReport(counts) {
  const expected = whole(counts.expected);
  const present = whole(counts.present);

  /*
   * ABSOLUTE, because drift runs both ways and both are wrong. An index holding
   * MORE than the corpus expects is stale items nobody pruned, which is how a
   * withdrawn post keeps answering. Reporting that as a negative number would
   * make a caller comparing `drift > 0` read it as healthy.
   */
  const drift = Math.abs(expected - present);

  return {
    uploaded: whole(counts.uploaded),
    removed: whole(counts.removed),
    cacheDropped: whole(counts.cacheDropped),
    expected,
    present,
    drift,
    // Never taken from the caller. See the docblock.
    converged: unreadable(counts.expected, counts.present) ? false : drift === 0,
  };
}

/**
 * A count that cannot be read is not a passing count.
 *
 * Same stance `ftsEqualityVerdict` takes: a missing or non-integer number means
 * the read failed, and a failed read must not average out to "agree".
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
 * One sentence for a human, with the numbers in it.
 *
 * @param {ReturnType<typeof askSyncReport>} report
 * @returns {string}
 */
export function askSyncSummary(report) {
  return report.converged
    ? `Ask index converged: ${report.expected} expected, ${report.present} present, ` +
        `${report.uploaded} uploaded, ${report.removed} removed.`
    : `ASK INDEX STILL SHORT: ${report.expected} expected, ${report.present} present, ` +
        `drift ${report.drift}, after uploading ${report.uploaded} and removing ${report.removed}.`;
}
