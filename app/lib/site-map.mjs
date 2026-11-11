/**
 * The site map page (/site-map), drawn from the one list of public URLs that sitemap.xml is also drawn from
 * (app/lib/site-urls.server.ts), so the two cannot drift. Pure, and relative imports only, so
 * test/site-map.test.mjs runs it under plain node.
 *
 * Grouped by the header menu's five sections, then Site. Every page is one line by its title, except the
 * kinds of page there are many of (papers, registry items, procedures, posts and tags): those are one line,
 * the count, linking to their index.
 */

/**
 * @typedef {{ key: string, label: string, to: string, merge: boolean }} Tally
 *   An item counted rather than listed. `to` is its index; with `merge`, the count goes on the index's own
 *   line (Publications (36)). Without it, the count is a line of its own in `to`'s section, as plain text
 *   (Tags (34)): the kind has no index of its own, and a second link to `to` under another name would make
 *   two links with different text go to one place.
 * @typedef {{ path: string, lastmod: Date | null, title: string, tally?: Tally, images?: string[] }} SiteUrl
 *   `images`: the site paths of the images the page shows, for sitemap.xml's image entries.
 * @typedef {{ to: string, label: string, count?: number, plain?: boolean }} SiteMapLine
 *   `plain`: shown as text, not a link; `to` then only places it in its section.
 * @typedef {{ id: string, heading: string, to: string | null, lines: SiteMapLine[] }} SiteMapSection
 */

/**
 * The sections, in the header's order (app/lib/nav.ts, NAV), then Site. `roots` are the address prefixes a
 * section owns; the first match wins, and a path no section owns is Site's. The System map sits under
 * Software, where the header's Software panel links it; the CV and the recipes sit under About, where the
 * About panel links them.
 */
export const SITE_MAP_SECTIONS = /** @type {const} */ ([
  { id: "research", heading: "Research", to: "/research", roots: ["/research"] },
  { id: "teaching", heading: "Teaching", to: "/teaching", roots: ["/teaching"] },
  { id: "software", heading: "Software", to: "/software", roots: ["/software", "/systems"] },
  { id: "writing", heading: "Writing", to: "/writing", roots: ["/writing"] },
  { id: "about", heading: "About", to: "/about", roots: ["/about", "/cv", "/recipes"] },
  { id: "site", heading: "Site", to: null, roots: [] },
]);

/** The page's own address. */
export const SITE_MAP_PATH = "/site-map";
