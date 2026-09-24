// The NOTE is what stops somebody deleting files a post-level tracker calls unreferenced (the roster
// photos are placed by a template). Entries with no files yet are kept; an empty section renders nothing.

/**
 * Order is render order.
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

/** @type {[string, string, string]} */
const ROOT = ["", "Brand and site files", "Referenced by the layout, never by a post"];

/**
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

  // Unknown folder: derive a title from its own directory rather than mislabel it as the root section.
  const at = key.lastIndexOf("/");
  if (at <= 0) return { prefix: ROOT[0], title: ROOT[1], note: ROOT[2] };
  const prefix = key.slice(0, at + 1);
  return { prefix, title: titleFromPrefix(prefix), note: "" };
}

/**
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
 * @param {string} prefix
 * @returns {number}
 */
export function folderRank(prefix) {
  const at = FOLDERS.findIndex(([p]) => p === prefix);
  return at === -1 ? FOLDERS.length : at;
}
