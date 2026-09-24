/**
 * Strips a trailing -copy or -copy-<n> so duplicating a duplicate stays flat (a-post-copy-2, not
 * a-post-copy-copy). A slug genuinely ending in -copy collides; accepted, since the rule is textual.
 *
 * @param {string} slug
 * @returns {string}
 */
function baseOf(slug) {
  const stripped = slug.replace(/-copy(?:-\d+)?$/, "");
  // A slug that is only the suffix would leave candidates starting with a hyphen.
  return stripped === "" ? slug : stripped;
}

/**
 * @param {string} slug
 * @param {number} [limit]
 * @returns {string[]}
 */
export function copySlugCandidates(slug, limit = 20) {
  const base = baseOf(slug);
  /** @type {string[]} */
  const out = [`${base}-copy`];
  // Starts at 2: the unnumbered candidate is the first copy.
  for (let n = 2; out.length < limit; n += 1) out.push(`${base}-copy-${n}`);
  return out;
}
