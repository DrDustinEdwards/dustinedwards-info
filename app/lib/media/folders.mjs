/**
 * What each folder IS, and why the files in it exist.
 *
 * **THIS TABLE IS THE DESIGN'S ARGUMENT, not a lookup.** Three sessions of the
 * v6 arc shipped the mockup's features and missed its point, and this is the
 * point: a media library is not a bucket of files, it is several kinds of file
 * that exist for different reasons, and the reader cannot tell which is which
 * from a filename. The NOTE is what does the work. "Placed by the roster page
 * template" is the sentence that stops somebody deleting nine photographs
 * because a post-level tracker called them unreferenced.
 *
 * TITLES AND NOTES ARE VERBATIM FROM THE MOCKUP where it gives them, because
 * they were written and refined deliberately. Where it gives a title and no
 * note, there is no note here either: an invented explanation is worse than
 * none, and a blank is honest.
 *
 * ## Adapted to THIS corpus, and the difference is stated
 *
 * The mockup's fixture carries `/uploads/`, `/site/`, `/teaching/` and
 * `/talks/`, which this library does not have, and it has no entry for the two
 * shapes this library actually carries most of: the `og/` R2 prefix with no
 * leading slash, and root-level static assets whose key is just `/logo.svg`.
 *
 * Measured against production, 2026-08-15: 31 in `/publications/`, 12 in `og/`,
 * 12 at the root, 9 in `/phage-hunters/`, 6 in `/diagrams/`, which is the whole
 * 70. The mockup's `/brand/` note describes our root files exactly, so it is
 * reused there rather than reinvented.
 *
 * The unused entries are KEPT. A section with no files renders nothing, and
 * keeping them means the day somebody adds `/uploads/` the note is already
 * written rather than being rediscovered.
 */

/**
 * Prefix, title, note. ORDER IS THE RENDER ORDER, so the sections a reader
 * most often wants come first rather than sorting alphabetically into
 * meaninglessness.
 *
 * @type {Array<[string, string, string]>}
 */
const FOLDERS = [
  ["/phage-hunters/", "Cohort photographs", "Placed by the roster page template"],
  ["og/", "Social cards", "Generated at build time"],
  ["/diagrams/", "Diagrams", ""],
  ["/publications/", "Publications", ""],
  ["/site/", "Site", ""],
  ["/uploads/", "Uploads", "Dropped here, not yet placed anywhere"],
  ["/teaching/", "Teaching", ""],
  ["/talks/", "Talks", ""],
  ["/brand/", "Brand", "Referenced by the layout, never by a post"],
];

/**
 * Where a key with no folder goes.
 *
 * ROOT-LEVEL STATIC ASSETS, which is `/logo.svg`, the favicons, the touch icon
 * and the manifest. The mockup has no entry for them because its
 * fixture put them under `/brand/`, and its `/brand/` note is exactly true of
 * ours, so it is carried over rather than reworded.
 *
 * An R2 upload key is content-addressed with no slash at all and would also
 * land here. That is correct for today, when there are none, and is the first
 * thing to revisit when uploads start arriving.
 */
/** @type {[string, string, string]} */
const ROOT = ["", "Brand and site files", "Referenced by the layout, never by a post"];

/**
 * The folder a key belongs to.
 *
 * LONGEST PREFIX WINS, so a future `/teaching/bio-3410/` entry would take
 * precedence over `/teaching/` rather than being shadowed by whichever came
 * first in the table.
 *
 * @param {string} key
 * @returns {{ prefix: string, title: string, note: string }}
 */
export function folderFor(key) {
  if (typeof key !== "string") {
    return { prefix: ROOT[0], title: ROOT[1], note: ROOT[2] };
  }
  /** @type {[string, string, string] | null} */
  let best = null;
  for (const [prefix, title, note] of FOLDERS) {
    if (!key.startsWith(prefix)) continue;
    if (!best || prefix.length > best[0].length) best = [prefix, title, note];
  }
  if (best) return { prefix: best[0], title: best[1], note: best[2] };

  /*
   * NO TABLE ENTRY. Derive from the key's own directory rather than sweeping it
   * into the root section.
   *
   * Collapsing every unknown folder into one heading would be the design's own
   * failure mode: a section that says "Brand and site files" over a directory
   * that is neither is exactly the kind of confident wrong label the notes
   * exist to prevent. A derived title says less and says it truthfully, and a
   * folder worth explaining earns a row in the table.
   */
  const at = key.lastIndexOf("/");
  if (at <= 0) return { prefix: ROOT[0], title: ROOT[1], note: ROOT[2] };
  const prefix = key.slice(0, at + 1);
  return { prefix, title: titleFromPrefix(prefix), note: "" };
}

/**
 * A readable heading from a bare path segment: `/case-studies/` to
 * `Case studies`. Sentence case, not title case, matching the mockup's own
 * headings ("Cohort photographs", "Social cards").
 *
 * @param {string} prefix
 * @returns {string}
 */
function titleFromPrefix(prefix) {
  const last = prefix.replace(/^\/+|\/+$/g, "").split("/").pop() ?? "";
  if (!last) return ROOT[1];
  const words = last.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The order a folder's section renders in, for sorting the grouped output.
 *
 * Root files sort LAST rather than first: they are the least interesting to
 * browse and the most numerous kind nobody is looking for.
 *
 * @param {string} prefix
 * @returns {number}
 */
export function folderRank(prefix) {
  const at = FOLDERS.findIndex(([p]) => p === prefix);
  return at === -1 ? FOLDERS.length : at;
}
