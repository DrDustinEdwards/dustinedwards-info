/**
 * The old WordPress site's addresses, answered on the apex host (and www) so they are live the moment
 * DNS moves: a 301 to the page that replaces each one, or 410 Gone for what was removed. The map is
 * cutover.md's "Redirect map" (Capsid, dustinedwards), decided 2026-09-27; this file is that record in
 * code, pattern rules first, then explicit rows.
 *
 * Host-scoped, because the workers.dev host serves the new site's own paths and must never see these.
 * `/phage-discovery` differs by host: this map runs first on the apex and sends the old WordPress page to
 * the program page, as cutover.md's row says; elsewhere path-moves.mjs sends the new site's own old
 * roster address to the roster anchor.
 *
 * Paths match with and without the trailing slash. The query is ignored: a 301 never carries it, since
 * WordPress's `?et_blog` and `?profiletab=` mean nothing on the new site.
 */

export const APEX_HOSTS = new Set(["dustinedwards.info", "www.dustinedwards.info"]);

/** @param {string} hostname */
export function isApexHost(hostname) {
  return APEX_HOSTS.has(hostname.toLowerCase());
}

const APEX_ORIGIN = "https://dustinedwards.info";

/**
 * Where a request to `www` goes: the apex, in ONE hop. The apex is the canonical host, so `www` serving the same
 * pages would be a second copy of every URL. An old WordPress address goes straight to the page that replaces it
 * (the map's own Location, which carries no query), so a `www` reader of an old URL is not sent through two
 * redirects. Everything else keeps its path and query. A removed address (410) goes to the apex too, which
 * answers it. Null for any host but `www`.
 *
 * @param {string} hostname
 * @param {string} pathname
 * @param {string} search the request's query string, with its `?`, or ""
 * @returns {string | null} an absolute https URL on the apex
 */
export function wwwRedirectTarget(hostname, pathname, search) {
  if (hostname.toLowerCase() !== "www.dustinedwards.info") return null;
  const disposition = wordpressDisposition(pathname);
  const target = disposition?.status === 301 ? disposition.location : `${pathname}${search}`;
  return new URL(target, APEX_ORIGIN).toString();
}

/**
 * Not kept, and not put in R2: its protocol is rewritten as a page, so the old PDF address, which
 * still earns clicks, points there (Dustin, 2026-09-27).
 */
export const BAYLOR_PDF = "/wp-content/uploads/2017/09/DNA-Extraction-Protocol-Baylor.pdf";
const CV_PDF = "/wp-content/uploads/2019/02/Dustin-Edwards-Curriculum-Vitae-2019.pdf";

/**
 * Targets whose pages do not exist yet. Every 301 into one of these answers 404 until its page job
 * lands, so the switch checklist reads this list: it must be empty, or each entry accepted, before
 * DNS moves.
 */
export const PENDING_TARGETS = [
  "/research",
  "/research/retroviruses",
  "/research/bacteriophages",
  "/research/science-education",
  "/research/phages",
  "/research/protocols",
  "/research/protocols/phage-isolation",
  "/research/protocols/phage-dna-extraction",
  "/research/protocols/coi-primers",
  "/research/protocols/rev-lpdv-primers",
  "/research/protocols/pan-avian-gapdh",
  "/teaching",
  "/teaching/phage-discovery",
  "/teaching/virus-isolation",
  "/teaching/phage-bioinformatics",
  "/teaching/central-dogma",
  "/teaching/study-skills",
  "/research/retroviruses/avian",
];

/**
 * @typedef {{ status: 301, location: string } | { status: 410 }} Disposition
 */

/** Where every student and author profile goes, except Dustin's own. */
export const PROFILE_TARGET = "/teaching/phage-discovery#roster";

/** @type {(location: string) => Disposition} */
const moved = (location) => ({ status: 301, location });
/** @type {Disposition} */
const GONE = { status: 410 };

/**
 * Pattern rules, in order; each reads the path without its trailing slash. `null` passes to the next.
 * @type {Array<(path: string) => Disposition | null>}
 */
const PATTERNS = [
  (p) => {
    const name = /^\/(?:discovery|annotation)-of-([a-z0-9-]+)$/i.exec(p)?.[1];
    return name ? moved(`/research/phages#${name.toLowerCase()}`) : null;
  },
  (p) =>
    ["/phylogenetics-lysm", "/arlo-gene-67", "/arlo-gene-67-cloning", "/raspberry-pi-plaque-counter"].includes(p)
      ? moved("/research/phages")
      : null,
  // The lab's own directory answered "how do I join", so it goes to Join the lab, ahead of the rule below.
  (p) => (p === "/directory-research-group" ? moved("/teaching#join-the-lab") : null),
  (p) => (/^\/directory-[^/]+$/.test(p) ? moved("/teaching/phage-discovery") : null),
  // Dustin's own author page ranks for his name, so it goes to the About page, ahead of the rule below.
  (p) => (p === "/author/dustin" ? moved("/about") : null),
  // The bare /user/ was the membership directory, so it is gone with the membership pages.
  (p) => (["/user", "/register", "/members", "/logout", "/account", "/password-reset"].includes(p) ? GONE : null),
  // Every other student and author profile (146 in Search Console, 147 with Dustin's own) goes to the
  // roster at the bottom of the Phage Discovery Program page, as on the old site (Dustin, 2026-09-27).
  (p) => (/^\/(?:user|author)(?:\/.*)?$/.test(p) ? moved(PROFILE_TARGET) : null),
  (p) =>
    /^\/(?:category\/phage-isolation-notes|microbiomes\/page|phages\/page)(?:\/.*)?$/.test(p)
      ? moved("/research/phages")
      : null,
  (p) => (/^\/knowledge-base\/category(?:\/.*)?$/.test(p) ? moved("/research/protocols") : null),
  (p) => (/^\/(?:category|tag)(?:\/.*)?$/.test(p) ? GONE : null),
  (p) => (p === BAYLOR_PDF ? moved("/research/protocols/phage-dna-extraction") : null),
  (p) => (p === CV_PDF ? moved("/cv") : null),
  (p) => (p.startsWith("/wp-content/uploads/") ? GONE : null),
  // Nothing on the new site does these calculations (Dustin, 2026-09-27).
  (p) => (["/molarity-calculator", "/knowledge-base/metric-prefix"].includes(p) ? GONE : null),
];

/** Explicit rows, keyed by the old path without its trailing slash. */
const ROWS = /** @type {Record<string, string>} */ ({
  "/knowledge-base/pcr-coi-lco1490-hco2198": "/research/protocols/coi-primers",
  // The old pages were a course and a program, so each goes to the course or program, not a protocol.
  "/virus-isolation": "/teaching/virus-isolation",
  "/phage-discovery": "/teaching/phage-discovery",
  // No Wolbachia page: it is not Dustin's research any more, so its methods land on the protocols.
  "/wolbachia-project-genetic-techniques": "/research/protocols",
  "/knowledge-base/pcr-wolbachia-16s-rrna": "/research/protocols",
  "/gentech-2018a": "/research/protocols",
  "/research": "/research",
  "/knowledge-base/pcr-rev-3-ltr-8000-8297": "/research/protocols/rev-lpdv-primers",
  "/knowledge-base/pcr-rev-pol-2500-3750": "/research/protocols/rev-lpdv-primers",
  "/knowledge-base/pcr-rev-pol-4777-5575": "/research/protocols/rev-lpdv-primers",
  "/knowledge-base/pcr-pan-avian-gapdh": "/research/protocols/pan-avian-gapdh",
  "/publications": "/research/publications",
  "/manuscripts": "/research/publications",
  "/knowledge-base/rev-lpdv-2018-2020-database": "/research/publications",
  "/knowledge-base/rev-lpdv-2023-2025-database": "/research/publications",
  "/virology-course": "/teaching",
  "/genetics-course": "/teaching",
  "/vaccines-course": "/teaching",
  "/cell-biology-course": "/teaching",
  "/lecture-courses": "/teaching",
  "/courses": "/teaching",
  "/related-courses": "/teaching",
  "/research-lab-courses": "/teaching",
  "/study-skills-guide": "/teaching/study-skills",
  "/prospective-students": "/teaching#join-the-lab",
  "/biomedical-sciences-academic-advising": "/teaching",
  "/teaching-philosophy": "/teaching#teaching-philosophy",
  "/tarleton-biological-sciences-biomedical-sciences-and-biology": "/teaching",
  "/phages": "/research/phages",
  "/phage-archives": "/research/phages",
  "/microbiomes": "/research",
  "/laboratory": "/research",
  "/phage-bioinformatics": "/teaching/phage-bioinformatics",
  "/phage-genetic-studies": "/research/bacteriophages",
  "/phage-discovery-application": "/teaching/phage-discovery",
  "/central-dogma-tutorials": "/teaching/central-dogma",
  "/retroviruses": "/research/retroviruses",
  "/rev-lpdv-surveys": "/research/retroviruses/avian",
  "/rev-lpdv-genetic-studies": "/research/retroviruses/avian",
  "/knowledge-base": "/research/protocols",
  "/virus-isolation-reagent-request": "/teaching/virus-isolation",
});

/** Kept at their own address: the home page, and the two pages the new site answers itself. */
const KEPT = new Set(["", "/contact", "/login"]);

/** Every explicit row's old path, for the tests. */
export const EXPLICIT_ROWS = Object.freeze({ ...ROWS });

/**
 * What an apex request for `pathname` gets: a 301 with its path-only Location, a 410, or null when the
 * new site answers the path itself (a kept page, or anything the map does not name).
 *
 * @param {string} pathname the request's pathname, already decoded by URL
 * @returns {{ status: 301, location: string } | { status: 410 } | null}
 */
export function wordpressDisposition(pathname) {
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return null;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : "";
  if (KEPT.has(path)) return null;

  let disposition = null;
  for (const rule of PATTERNS) {
    disposition = rule(path);
    if (disposition) break;
  }
  const row = Object.hasOwn(ROWS, path) ? ROWS[path] : undefined;
  if (!disposition && row) disposition = moved(row);
  if (!disposition) return null;

  // A row that rebuilds a page at its own address (`/research/` to `/research`) redirects only the
  // slashed form; the bare form is the page, and redirecting it to itself would loop.
  if (disposition.status === 301 && disposition.location === pathname) return null;
  return disposition;
}
