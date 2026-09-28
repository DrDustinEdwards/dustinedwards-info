/**
 * The 2026-09-27 site structure moved two sections: /blog to /writing, and /publications to
 * /research/publications. Nothing linked to the new site's old addresses yet, but they were public,
 * so each keeps answering with a 301 to the same page at its new address. Runs in the gateway, before
 * the renamed-post and PDF maps, so an old post slug or an old PDF name still resolves in one hop.
 *
 * The old feed addresses are not moved: they are routes of their own (app/routes.ts) and keep
 * answering with the feed, because a feed reader may never follow a redirect.
 */

const MOVES = /** @type {const} */ ([
  ["/blog", "/writing"],
  ["/publications", "/research/publications"],
]);

/** Whole paths, not prefixes. `/projects/foo` is not a page and must not move. */
const EXACT_MOVES = new Map([
  ["/projects", "/software"],
  ["/projects/", "/software"],
  ["/phage-discovery", "/teaching/phage-discovery#roster"],
  ["/phage-discovery/", "/teaching/phage-discovery#roster"],
]);

/** The feed files a reader subscribes to, under /blog, /blog/tags/<tag> or /blog/series/<series>. */
const FEED_FILES = new Set(["rss.xml", "feed.json", "atom.xml"]);

/**
 * @param {string} rest the path after `/blog`, starting with `/`
 * @returns {boolean}
 */
function isLegacyFeed(rest) {
  const parts = rest.split("/").filter(Boolean);
  const file = parts.at(-1) ?? "";
  if (!FEED_FILES.has(file)) return false;
  if (parts.length === 1) return true;
  // /blog/tags/<tag>/rss.xml and /blog/series/<series>/feed.json; atom exists only for the whole site.
  return parts.length === 3 && (parts[0] === "tags" || parts[0] === "series") && file !== "atom.xml";
}

/**
 * Returns a path, not a URL, so the redirect cannot be talked into naming another host.
 *
 * @param {string} pathname the request's pathname, already decoded by URL
 * @returns {string | null} the new path, or null when this path did not move
 */
export function movedPathTarget(pathname) {
  if (typeof pathname !== "string") return null;
  if (EXACT_MOVES.has(pathname)) return EXACT_MOVES.get(pathname) ?? null;
  for (const [from, to] of MOVES) {
    if (pathname === from) return to;
    // `/publications.bib` and friends sit beside the section rather than under it.
    const next = pathname.charAt(from.length);
    if (!pathname.startsWith(from) || (next !== "/" && next !== ".")) continue;
    const rest = pathname.slice(from.length);
    if (from === "/blog" && isLegacyFeed(rest)) return null;
    return `${to}${rest}`;
  }
  return null;
}
