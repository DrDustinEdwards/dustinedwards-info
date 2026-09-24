/**
 * What ship reads off `sync:content` output. Pure, so the retried-sync case can be replayed from a
 * transcript rather than from a live database.
 */

/**
 * The render-drift count from a sync's drift line, or null when the line is absent.
 * @param {string} text
 * @returns {number | null}
 */
export function driftCount(text) {
  const line = text.match(/sync:content drift: .*render-drift=(\d+)/);
  return line ? Number(line[1]) : null;
}

/**
 * The three search counts from a sync's summary line, or null when the line is absent.
 *
 * READ FROM THE RUN THAT WROTE LAST. When ship confirms render drift with a second sync, that
 * second run rewrote every row, so its counts are the state D1 is in; the first run may have
 * failed partway and printed none.
 *
 * @param {string} text
 * @returns {[string, string, string] | null}
 */
export function searchCounts(text) {
  const m = text.match(/search_docs=(\d+)\s+identity=(\d+)\s+prose=(\d+)/);
  return m ? [m[1], m[2], m[3]] : null;
}

/**
 * The sync whose output is the verdict: the confirming run when there was one, else the first.
 *
 * @template T
 * @param {T} first
 * @param {T | null} confirm
 * @returns {T}
 */
export function standingRun(first, confirm) {
  return confirm ?? first;
}
