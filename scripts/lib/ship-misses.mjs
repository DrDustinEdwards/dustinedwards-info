// What ship prints when the deploy landed but a later step missed. One row per miss in a table, so a
// new step adds a row rather than a fifth copy of the same branch.

/**
 * @typedef {object} ShipMiss
 * @property {string} key the short name printed beside the miss
 * @property {string} title what is behind, in the headline
 * @property {string} text the miss, or "" when the step did not miss
 */

/**
 * The lines ship prints to stderr before it exits nonzero, or none when nothing missed. Every miss
 * is named: the faults are independent.
 *
 * @param {ShipMiss[]} misses in the order the steps ran
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
    `\n  The deploy at ${sha} STANDS and the site is serving it. A stale index\n` +
      `  means Ask can miss recent writing or the media library can misdescribe\n` +
      `  assets until its sync succeeds; both operations are idempotent: re-run\n` +
      `  \`npm run ship\`, or call sync_ask / sync_media on the operator API.\n` +
      `  Render drift here has ALREADY SURVIVED a converge write and a second\n` +
      `  sync, so it is not the benign ordering artifact of ruling 30, which\n` +
      `  clears on the second run and is reported as confirmed benign above.\n` +
      `  Either the sync's write is not taking or something else is writing\n` +
      `  render_hash. Read the two hashes the sync named, and start at what\n` +
      `  wrote the D1 one; a re-run is not the repair.\n\n` +
      `  A WATCHDOG miss is the one line above that is about the WATCHER rather\n` +
      `  than the site: the previously deployed watchdog keeps firing, so the\n` +
      `  site is still watched, by older code. Re-run \`npm run ship\`, or deploy\n` +
      `  it alone with \`npx wrangler deploy -c wrangler.watchdog.jsonc\`.\n\n` +
      `  The watchdog reads the same index drift every fifteen minutes and\n` +
      `  attempts the same repair itself before it alerts; the external uptime\n` +
      `  monitors are the off-platform second opinion.`,
    `${"!".repeat(64)}\n`,
  ];
}
