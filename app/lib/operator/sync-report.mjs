/**
 * WHAT A SYNC CALL REPORTS, AND WHEN IT COUNTS AS DONE.
 *
 * Two indexes, one rule. Renamed from `ask-sync-report.mjs` on 2026-08-24 when
 * the media index gained a sync of its own: the file held the only statement of
 * what "converged" means, and a second copy of that beside it would have been a
 * second answer to the question `ship` refuses on.
 *
 * The convergence arithmetic is shared (`convergence`). What is NOT shared is
 * how each index measures drift, and the difference is stated at
 * `mediaSyncReport` rather than smoothed over: Ask drifts by COUNT and media
 * drifts by KEY.
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
 * @see test/sync-report.test.mjs
 * @see app/lib/operator/api.server.ts
 */

/**
 * The report body for one sync_ask call.
 *
 * A WRITE THAT FAILED IS NOT CONVERGED, WHATEVER THE COUNTS SAY. `failed` names the keys the upload
 * could not land after its retries. Before it existed, a failed twin upload was logged and dropped,
 * the read-back showed one short, and ship waited that out as eventual consistency: a failure was
 * reported as an index catching up (2026-09-23, `ask-twins.mjs`). Now any failed key makes
 * `converged` false even if the counts happen to agree, and the keys travel so the caller can name
 * them rather than wait.
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
 * }}
 */
export function askSyncReport(counts) {
  const agreement = convergence(counts.expected, counts.present);
  const failed = Array.isArray(counts.failed) ? counts.failed : [];
  return {
    uploaded: whole(counts.uploaded),
    removed: whole(counts.removed),
    cacheDropped: whole(counts.cacheDropped),
    ...agreement,
    converged: agreement.converged && failed.length === 0,
    failed,
  };
}

/**
 * WHETHER TWO READ-BACK COUNTS AGREE. The one owner of that arithmetic.
 *
 * Extracted 2026-08-24 when the media index gained a sync of its own. It was
 * inline in `askSyncReport`, and the alternative was a second copy carrying the
 * same four lines: the absolute drift, the unreadable guard, and the rule that
 * `converged` is derived rather than accepted. A second copy of THAT is a
 * second answer to "did the sync work", which is rule 17's subject and, worse
 * than usual here, is the answer `ship` refuses on.
 *
 * ABSOLUTE, because drift runs both ways and both are wrong. An index holding
 * MORE than its source expects is stale entries nobody pruned, which is how a
 * withdrawn post keeps answering and how a deleted object keeps appearing in
 * the library. Reporting that as a negative number would make a caller
 * comparing `drift > 0` read it as healthy.
 *
 * @param {unknown} expectedRaw @param {unknown} presentRaw
 * @returns {{ expected: number, present: number, drift: number, converged: boolean }}
 */
export function convergence(expectedRaw, presentRaw) {
  const expected = whole(expectedRaw);
  const present = whole(presentRaw);
  const drift = Math.abs(expected - present);
  return {
    expected,
    present,
    drift,
    // Never taken from the caller. See the docblock at the top of this file.
    converged: unreadable(expectedRaw, presentRaw) ? false : drift === 0,
  };
}

/**
 * The report body for one sync_media call.
 *
 * ## THE COUNTS THAT DECIDE ARE NOT THE COUNTS THE REBUILD RETURNS
 *
 * `indexed` and `removed` are what `rebuildMediaIndex`'s loops think they
 * wrote, and they are carried here for a human to read. `expected` and
 * `present` come from `mediaIndexStatus`, which re-enumerates the buckets and
 * the manifest and reads D1 back AFTERWARDS. Only the second pair decides.
 *
 * ## AND DRIFT IS THE SUM, NOT THE DIFFERENCE
 *
 * This is the one place the media verdict must NOT reuse the answer index's
 * shape unthinkingly. The two indexes fail differently: Ask drifts by count,
 * media drifts by KEY, and a rebuild that dropped one file while inventing one
 * row leaves the two totals identical. `convergence()` would call that
 * converged, correctly for a count comparison and wrongly for this one, so the
 * key sets are compared and `missing` and `extra` are added.
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

  return {
    indexed: whole(counts.indexed),
    removed: whole(counts.removed),
    expected: totals.expected,
    present: totals.present,
    drift,
    missing,
    extra,
    failures,
    /*
     * THREE CONDITIONS, and the third is the one a count comparison misses.
     * The totals must be readable and equal, the key sets must agree in both
     * directions, and nothing may have FAILED to derive: a key that threw
     * during the rebuild is absent from the index for a reason the reconciler
     * cannot see, because a failed derivation leaves no row and no source
     * change, so both sides agree about a key that is simply wrong.
     */
    converged: totals.converged && drift === 0 && failures.length === 0,
  };
}

/** @param {unknown} v @returns {string[]} */
function list(v) {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

/**
 * One sentence for a human, with the numbers in it.
 *
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
  ].filter(Boolean);
  return (
    `MEDIA INDEX STILL DRIFTED: ${report.expected} expected, ${report.present} present` +
    (why.length ? ` (${why.join(", ")})` : "") +
    `, after indexing ${report.indexed} and removing ${report.removed}.`
  );
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
  if (report.failed?.length) {
    return (
      `ASK UPLOAD FAILED for ${report.failed.length} key(s) after retries: ` +
      `${report.failed.map((f) => `${f.key} (${f.error})`).join(", ")}. ` +
      `${report.expected} expected, ${report.present} present.`
    );
  }
  return report.converged
    ? `Ask index converged: ${report.expected} expected, ${report.present} present, ` +
        `${report.uploaded} uploaded, ${report.removed} removed.`
    : `ASK INDEX STILL SHORT: ${report.expected} expected, ${report.present} present, ` +
        `drift ${report.drift}, after uploading ${report.uploaded} and removing ${report.removed}.`;
}
