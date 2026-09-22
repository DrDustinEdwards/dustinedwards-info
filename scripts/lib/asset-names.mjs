/**
 * Ruling 127's rule, stated once for both halves of the gate: every file that leaves the site is
 * named `dustin-edwards-...`. `check:asset-names` applies it to `public/` and the routes offline;
 * `check:media` applies it to the R2 listing it already holds on the network tier.
 */

import { ASSET_PREFIX, isContentKey } from "../../app/lib/media/classify.mjs";

/**
 * Served names that keep their names, each with the reason. A reason that stops being true is a
 * rename, not a longer list.
 *
 * @type {Map<string, string>}
 */
export const EXEMPT_STATIC = new Map([
  [
    "/favicon.ico",
    "A browser requests /favicon.ico unprompted, with no link naming it. Renamed, every page " +
      "view from such a client is a 404.",
  ],
  [
    "/site.webmanifest",
    "Read by the browser to install the site, never downloaded by a reader.",
  ],
  [
    "/_headers",
    "Cloudflare asset header rules, consumed at deploy and never served.",
  ],
]);

/**
 * Generated twins under `public/`, gitignored and absent from a clean checkout, so a pattern
 * rather than a list. The twin's URL is the paper's address plus `.md`, a representation of a page
 * in the manner of `/blog/<slug>.md`, not a file with a name of its own.
 */
export const EXEMPT_STATIC_PATTERNS = [
  { test: /^\/publications\/[a-z0-9-]+\.md$/, why: "the markdown twin of a paper page" },
];

/**
 * Routes whose URL ends in an extension and whose name is fixed by a protocol or is the address of
 * a page in another format. Every OTHER such route must set a prefixed download name.
 *
 * @type {Map<string, string>}
 */
export const EXEMPT_ROUTES = new Map([
  ["robots.txt", "fixed by the robots exclusion protocol"],
  ["sitemap.xml", "the address robots.txt declares; crawlers fetch it by URL"],
  ["llms.txt", "fixed by the llms.txt convention"],
  ["llms-full.txt", "fixed by the llms.txt convention"],
  ["blog/rss.xml", "a feed address subscribed to by URL"],
  ["blog/feed.json", "a feed address subscribed to by URL"],
  ["blog/atom.xml", "a feed address subscribed to by URL"],
  ["blog/tags/:tag/rss.xml", "a feed address subscribed to by URL"],
  ["blog/tags/:tag/feed.json", "a feed address subscribed to by URL"],
  ["blog/series/:series/rss.xml", "a feed address subscribed to by URL"],
  ["blog/series/:series/feed.json", "a feed address subscribed to by URL"],
  ["blog/:slug.md", "the markdown twin of a post, a representation of the page"],
]);

/**
 * Why a site-absolute static path breaks the rule, or null when it complies or is exempt.
 * @param {string} sitePath e.g. `/phage-hunters/dustin-edwards-2017.webp`
 * @returns {string | null}
 */
export function staticNameProblem(sitePath) {
  if (EXEMPT_STATIC.has(sitePath)) return null;
  if (EXEMPT_STATIC_PATTERNS.some((p) => p.test.test(sitePath))) return null;
  const base = sitePath.slice(sitePath.lastIndexOf("/") + 1);
  if (!base.startsWith(ASSET_PREFIX)) return `"${base}" does not start with "${ASSET_PREFIX}"`;
  if (base !== base.toLowerCase()) return `"${base}" is not lower case`;
  return null;
}

/**
 * Why an R2 object key breaks the rule, or null. MEDIA keys must parse as content keys, whose
 * grammar opens with the prefix; OG keys must open `og/<prefix>`.
 * @param {string} key
 * @returns {string | null}
 */
export function objectKeyProblem(key) {
  if (key.startsWith("og/")) {
    return key.startsWith(`og/${ASSET_PREFIX}`) ? null : `social card "${key}" is unprefixed`;
  }
  return isContentKey(key) ? null : `"${key}" is not a ${ASSET_PREFIX} content key`;
}
