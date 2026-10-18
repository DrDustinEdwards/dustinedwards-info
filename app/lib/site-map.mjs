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
 * About panel links them. test/site-map.test.mjs holds the five headings to the header's.
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

/** @param {string} path @param {string} root */
const under = (path, root) => path === root || path.startsWith(`${root}/`);

/** The id of the section a path belongs to. @param {string} path */
export function sectionOf(path) {
  const found = SITE_MAP_SECTIONS.find((section) => section.roots.some((root) => under(path, root)));
  return found ? found.id : "site";
}

/**
 * The page's sections, from the URL list. Lines keep the list's order, except that a section's own hub
 * comes first. A section with no line is left out.
 *
 * @param {SiteUrl[]} urls
 * @returns {SiteMapSection[]}
 */
export function siteMapSections(urls) {
  /** @type {Map<string, { tally: Tally, count: number }>} */
  const tallies = new Map();
  /** @type {SiteMapLine[]} */
  const lines = [];
  for (const url of urls) {
    if (url.tally) {
      const seen = tallies.get(url.tally.key);
      if (seen) seen.count += 1;
      else tallies.set(url.tally.key, { tally: url.tally, count: 1 });
      continue;
    }
    lines.push({ to: url.path, label: url.title });
  }
  for (const { tally, count } of tallies.values()) {
    const index = tally.merge ? lines.find((line) => line.to === tally.to && line.count === undefined && !line.plain) : undefined;
    if (index) index.count = count;
    else lines.push({ to: tally.to, label: tally.label, count, ...(tally.merge ? {} : { plain: true }) });
  }
  return SITE_MAP_SECTIONS.map(({ id, heading, to }) => {
    const own = lines.filter((line) => sectionOf(line.to) === id);
    const isHub = (/** @type {SiteMapLine} */ line) => line.to === to && !line.plain;
    return { id, heading, to, lines: [...own.filter(isHub), ...own.filter((line) => !isHub(line))] };
  }).filter((section) => section.lines.length > 0);
}

/** A line's text: its label, and its count in brackets when it has one. @param {SiteMapLine} line */
export function lineText(line) {
  return line.count === undefined ? line.label : `${line.label} (${line.count})`;
}
