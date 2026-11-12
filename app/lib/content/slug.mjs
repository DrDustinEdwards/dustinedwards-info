// Split out of pipeline.mjs so importing a constant does not evaluate the renderer in the Worker;
// pipeline.mjs re-exports every name here. The slug rule is Prelum's, the network's one rule (120 characters, as the
// MCP wrapper's slugSchema takes).

export {
  SLUG_ATTRIBUTE_PATTERN,
  SLUG_MAX_LENGTH,
  SLUG_PATTERN,
} from "@drdustinedwards/site-helpers/slug";

/**
 * Lives here, not in publish.server.ts, because the build scripts cannot import a .server file.
 *
 * @param {string} slug
 * @returns {string}
 */
export const postPath = (slug) => `content/posts/${slug}.md`;
