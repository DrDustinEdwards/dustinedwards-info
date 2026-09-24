/**
 * @param {string} text
 * @returns {number | null}
 */
export function driftCount(text) {
  const line = text.match(/sync:content drift: .*render-drift=(\d+)/);
  return line ? Number(line[1]) : null;
}

/**
 * Read from the run that wrote last: a confirming second sync rewrote every row, and the first may
 * have failed partway and printed none.
 *
 * @param {string} text
 * @returns {[string, string, string] | null}
 */
export function searchCounts(text) {
  const m = text.match(/search_docs=(\d+)\s+identity=(\d+)\s+prose=(\d+)/);
  return m ? [m[1], m[2], m[3]] : null;
}

/**
 * @template T
 * @param {T} first
 * @param {T | null} confirm
 * @returns {T}
 */
export function standingRun(first, confirm) {
  return confirm ?? first;
}
