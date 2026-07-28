/**
 * The mapping between a search record and its AI Search item key.
 *
 * Plain .mjs, imported by BOTH the server module that uploads the corpus and
 * the client chunk that renders citations, exactly as `records.mjs` is imported
 * by both writers and `query.mjs` by the route and the gate. A citation URL
 * derived one way on upload and another way on render is the kind of drift that
 * points readers at headings that do not exist, so there is one implementation.
 *
 * AI Search identifies a source chunk by `item.key` and carries nothing else
 * about where it came from, so the key IS the citation.
 */

/**
 * Separates slug from heading anchor inside an item key.
 *
 * Slugs and heading anchors are lowercase kebab, so a DOUBLE underscore cannot
 * occur inside either. A single underscore can: a heading like
 * `posts_fts and triggers` produces exactly that, on a blog that talks about
 * fts5 constantly. The upload path asserts the separator is absent rather than
 * trusting this note.
 */
export const KEY_SEPARATOR = "__";

/**
 * The item key for a record URL.
 *
 * @param {string} url `/blog/<slug>` or `/blog/<slug>#<anchor>`
 * @returns {string} `blog/<slug>.md` or `blog/<slug>__<anchor>.md`
 */
export function keyForUrl(url) {
  const [path, anchor] = url.replace(/^\//, "").split("#");
  return anchor ? `${path}${KEY_SEPARATOR}${anchor}.md` : `${path}.md`;
}

/**
 * The site URL an item key came from.
 *
 * Returns null rather than a guess for a key this site did not write. An
 * instance can hold items from another source, and a citation pointing at a URL
 * that does not exist is worse than a citation that is absent.
 *
 * @param {string} key
 * @returns {string | null}
 */
export function urlForKey(key) {
  if (typeof key !== "string" || !key.endsWith(".md")) return null;
  const withoutExtension = key.slice(0, -3);
  const parts = withoutExtension.split(KEY_SEPARATOR);
  if (parts.length > 2) return null;
  const [path, anchor] = parts;
  if (!path.startsWith("blog/")) return null;
  return anchor ? `/${path}#${anchor}` : `/${path}`;
}

/**
 * A readable label for a citation.
 *
 * The heading text is not carried on the chunk, so the anchor is un-slugged.
 * This is a LABEL, not data. The link is the part that has to be right.
 *
 * @param {string} url
 * @returns {string}
 */
export function labelForUrl(url) {
  const [path, anchor] = url.split("#");
  const target = anchor ?? path.replace(/^\/blog\//, "");
  const words = target
    .replace(/^\d+-/, "")
    .split("-")
    .filter(Boolean);
  if (words.length === 0) return "Untitled";
  return words.join(" ").replace(/^./, (c) => c.toUpperCase());
}
