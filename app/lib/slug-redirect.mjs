/**
 * Runs in the gateway, not the route: the route's 404 comes after a D1 read, and behind the cache
 * loopback a stored 404 for an old slug would outlive the fix. Target existence is checked at build
 * time by `check:urls`, so the gateway never needs the database.
 *
 * The map is an argument, not an import: tsc here rejects `with { type: "json" }` and Node ESM
 * requires it, so no JSON import works in both.
 */

const BLOG_PREFIX = "/blog/";

const MARKDOWN_SUFFIX = ".md";

/**
 * Returns a path, not a URL, so the redirect cannot be talked into naming another host.
 *
 * @param {string} pathname the request's pathname, already decoded by URL
 * @param {Record<string, string>} map old slug to new slug
 * @returns {string | null}
 */
export function postRedirectTarget(pathname, map) {
  if (typeof pathname !== "string") return null;
  if (!map || typeof map !== "object") return null;
  if (!pathname.startsWith(BLOG_PREFIX)) return null;

  const rest = pathname.slice(BLOG_PREFIX.length);
  // `/blog/tags/x` and `/blog/series/x` share the prefix; a slash means another route's URL.
  if (rest.includes("/")) return null;

  const markdown = rest.endsWith(MARKDOWN_SUFFIX);
  const slug = markdown ? rest.slice(0, -MARKDOWN_SUFFIX.length) : rest;

  // Own property only: a bare lookup would redirect `/blog/constructor` via an inherited key.
  if (!Object.hasOwn(map, slug)) return null;

  const target = map[slug];
  if (typeof target !== "string" || target.length === 0) return null;
  return `${BLOG_PREFIX}${target}${markdown ? MARKDOWN_SUFFIX : ""}`;
}

/**
 * Same split as the HTTPS redirect, so the two helpers never teach different rules.
 *
 * @param {string} method
 * @returns {number}
 */
export function postRedirectStatus(method) {
  const m = String(method ?? "").toUpperCase();
  return m === "GET" || m === "HEAD" ? 301 : 308;
}
