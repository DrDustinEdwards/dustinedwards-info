// Split out of pipeline.mjs so importing a constant does not evaluate the renderer in the Worker;
// pipeline.mjs re-exports every name here.

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A separate rule, not a lookahead in SLUG_PATTERN, because unanchor() would strip the wrong anchor.
 * 120 matches the MCP wrapper's slugSchema (another repo): a longer slug there cannot be named.
 */
export const SLUG_MAX_LENGTH = 120;

// The browser anchors a pattern attribute implicitly, so the anchors come off.
export const SLUG_ATTRIBUTE_PATTERN = unanchor(SLUG_PATTERN.source);

/**
 * String methods on purpose: an anchor-stripping regex is easy to write as a silent no-op.
 *
 * @param {string} source
 * @returns {string}
 */
function unanchor(source) {
  let out = source.startsWith("^") ? source.slice(1) : source;
  if (out.endsWith("$")) out = out.slice(0, -1);
  return out;
}

/**
 * Lives here, not in publish.server.ts, because the build scripts cannot import a .server file.
 *
 * @param {string} slug
 * @returns {string}
 */
export const postPath = (slug) => `content/posts/${slug}.md`;
