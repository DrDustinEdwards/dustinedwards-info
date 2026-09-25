// AI Search carries nothing but item.key about a chunk's source, so the key IS the citation.

/**
 * Double underscore: kebab slugs and anchors cannot contain it, but a single one can (posts_fts).
 */
export const KEY_SEPARATOR = "__";

/**
 * The trailing slash is stripped, so a paper's key is exactly its markdown twin's URL.
 *
 * @param {string} url `/blog/<slug>`, `/blog/<slug>#<anchor>` or `/publications/<slug>/`
 * @returns {string} `blog/<slug>.md`, `blog/<slug>__<anchor>.md` or `publications/<slug>.md`
 */
export function keyForUrl(url) {
  const [path, anchor] = url.replace(/^\//, "").replace(/\/$/, "").split("#");
  return anchor ? `${path}${KEY_SEPARATOR}${anchor}.md` : `${path}.md`;
}

/**
 * Whether an item key is one of this post's: its document key or one of its section keys. Exact key
 * or section prefix, never startsWith(slug), which would sweep up a longer slug.
 *
 * @param {string} slug
 * @returns {(key: string) => boolean}
 */
export function ownsAskKey(slug) {
  const documentKey = keyForUrl(`/blog/${slug}`);
  const sectionPrefix = `${documentKey.replace(/\.md$/, "")}${KEY_SEPARATOR}`;
  return (key) => key === documentKey || key.startsWith(sectionPrefix);
}

/**
 * Null for a key this site did not write: an instance can hold items from another source.
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
  if (!path) return null;
  // A paper cites its page, not its twin, with the canonical trailing slash (the slashless form redirects).
  if (path.startsWith("publications/")) return anchor ? null : `/${path}/`;
  if (!path.startsWith("blog/")) return null;
  return anchor ? `/${path}#${anchor}` : `/${path}`;
}

/**
 * @param {string} key
 * @returns {string | null}
 */
export function slugForKey(key) {
  const url = urlForKey(key);
  if (!url) return null;
  // Posts only: a paper has no posts row, and passing its URL as a slug would make every answer citing
  // it unreplayable forever.
  if (!url.startsWith("/blog/")) return null;
  const slug = (url.split("#")[0] ?? "").replace(/^\/blog\//, "");
  return slug.length > 0 ? slug : null;
}

/**
 * @param {string} url
 * @returns {string}
 */
export function labelForUrl(url) {
  const [path, anchor] = url.split("#");
  // The slug, not a DOI: the DOI-to-slug fold is lossy, and a plausible reconstruction is worse than none.
  if ((path ?? "").startsWith("/publications/")) {
    return `Paper ${(path ?? "").replace(/^\/publications\//, "").replace(/\/$/, "")}`;
  }
  const target = anchor ?? (path ?? "").replace(/^\/blog\//, "");
  const words = target
    .replace(/^\d+-/, "")
    .split("-")
    .filter(Boolean);
  if (words.length === 0) return "Untitled";
  return words.join(" ").replace(/^./, (c) => c.toUpperCase());
}
