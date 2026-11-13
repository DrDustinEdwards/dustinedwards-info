// What converge prints when the deploy landed but a later step missed. One row per miss in a table, so a
// new step adds a row rather than a fifth copy of the same branch.

/**
 * @typedef {object} ConvergeMiss
 * @property {string} key the short name printed beside the miss
 * @property {string} title what is behind, in the headline
 * @property {string} text the miss, or "" when the step did not miss
 * @property {string} [advice] what to do about this miss, printed only when this step missed
 */

/** For the two index syncs. */
export const INDEX_ADVICE =
  `A stale index means Ask can miss recent writing or the media library can\n` +
  `  misdescribe assets until its sync succeeds; both operations are idempotent:\n` +
  `  re-run the deploy's converge job, or call sync_ask / sync_media on the operator\n` +
  `  API. Capsid's watcher reads the same index drift every five minutes and\n` +
  `  attempts the same repair itself before it alerts.`;

/** For render drift that outlived the confirming second sync, and only for it (it was printed on every miss). */
export const RENDER_ADVICE =
  `Render drift here has ALREADY SURVIVED a converge write and a second\n` +
  `  sync, so it is not the benign first-sync ordering artifact (a render\n` +
  `  from the previously deployed Worker), which clears on the second run and\n` +
  `  is reported as confirmed benign above. Either the sync's write is not\n` +
  `  taking or something else is writing render_hash. Read the two hashes the\n` +
  `  sync named, and start at what wrote the D1 one; a re-run is not the repair.`;

/**
 * The lines converge prints to stderr before it exits nonzero, or none when nothing missed. Every miss
 * is named: the faults are independent.
 *
 * @param {ConvergeMiss[]} misses in the order the steps ran
 * @param {string} sha the commit that was deployed
 * @returns {string[]}
 */
export function missReport(misses, sha) {
  const missed = misses.filter((m) => m.text);
  if (missed.length === 0) return [];
  const behind = missed.map((m) => m.title).join(" AND ");
  return [
    `\n${"!".repeat(64)}`,
    `  DEPLOYED, BUT ${behind} ${missed.length > 1 ? "NEED" : "NEEDS"} ATTENTION.`,
    ...missed.map((m) => `  ${`${m.key}:`.padEnd(10)}${m.text}`),
    `\n  The deploy at ${sha} STANDS and the site is serving it.`,
    // Each piece of advice once, even when two misses share it.
    ...[...new Set(missed.map((m) => m.advice).filter(Boolean))].map((advice) => `\n  ${advice}`),
    `${"!".repeat(64)}\n`,
  ];
}
