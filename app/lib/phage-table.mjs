/**
 * The address of a PhagesDB record. The phage table on /research/phages is drawn from the phage rows (content/phages,
 * docs/PHAGES.md): into the page's markdown, which the twin, the search records and the page's invariants read, and
 * into Capsomer's catalog for the HTML (app/lib/phages/catalog.mjs). The phage rows are judged by
 * app/lib/phages/compile.mjs.
 */

/**
 * The human page for a PhagesDB record name.
 *
 * @param {string} record
 */
export function phagesDbUrl(record) {
  return `https://phagesdb.org/phages/${record}/`;
}
