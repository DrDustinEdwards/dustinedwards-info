/**
 * The old WordPress site's addresses, answered on the apex host (and www) so they are live the moment
 * DNS moves: a 301 to the page that replaces each one, or 410 Gone for what was removed. The map is
 * cutover.md's "Redirect map" (Capsid, dustinedwards), decided 2026-09-27; this file is that record in
 * code, pattern rules first, then explicit rows.
 *
 * Host-scoped, because the workers.dev host serves the new site's own paths and must never see these:
 * `/phage-discovery` is a page there and a 301 here.
 *
 * Paths match with and without the trailing slash. The query is ignored: a 301 never carries it, since
 * WordPress's `?et_blog` and `?profiletab=` mean nothing on the new site.
 */

export const APEX_HOSTS = new Set(["dustinedwards.info", "www.dustinedwards.info"]);

/** @param {string} hostname */
export function isApexHost(hostname) {
  return APEX_HOSTS.has(hostname.toLowerCase());
}

/** The PDF kept at its old path, served from R2 once job_1c20d727924c has saved it. */
export const BAYLOR_PDF = "/wp-content/uploads/2017/09/DNA-Extraction-Protocol-Baylor.pdf";
const CV_PDF = "/wp-content/uploads/2019/02/Dustin-Edwards-Curriculum-Vitae-2019.pdf";

/**
 * Targets whose pages do not exist yet. Every 301 into one of these answers 404 until its page job
 * lands, so the switch checklist reads this list: it must be empty, or each entry accepted, before
 * DNS moves. Kept pages that are not built yet (`/contact`) and the Baylor PDF are here for the same
 * reason.
 */
export const PENDING_TARGETS = [
  "/research",
  "/research/phages",
  "/research/phage-discovery",
  "/research/rev-lpdv",
  "/research/wolbachia",
  "/research/protocols",
  "/research/protocols/coi-primers",
  "/research/protocols/phage-isolation",
  "/research/protocols/rev-lpdv-primers",
  "/research/protocols/pan-avian-gapdh",
  "/research/protocols/wolbachia-16s",
  "/teaching",
  "/contact",
  BAYLOR_PDF,
];

/**
 * @typedef {{ status: 301, location: string } | { status: 410 } | { status: "keep" }} Disposition
 */

/** @type {(location: string) => Disposition} */
const moved = (location) => ({ status: 301, location });
/** @type {Disposition} */
const GONE = { status: 410 };
/** @type {Disposition} */
const KEEP = { status: "keep" };

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
  (p) => (/^\/directory-[^/]+$/.test(p) ? moved("/research/phage-discovery") : null),
  // Student and author profiles: removed, and never redirected to anything that names them.
  (p) => (/^\/(?:user|author)(?:\/.*)?$/.test(p) ? GONE : null),
  (p) => (["/register", "/members", "/logout", "/account", "/password-reset"].includes(p) ? GONE : null),
  (p) =>
    /^\/(?:category\/phage-isolation-notes|microbiomes\/page|phages\/page)(?:\/.*)?$/.test(p)
      ? moved("/research/phages")
      : null,
  (p) => (/^\/knowledge-base\/category(?:\/.*)?$/.test(p) ? moved("/research/protocols") : null),
  (p) => (/^\/(?:category|tag)(?:\/.*)?$/.test(p) ? GONE : null),
  (p) => (p === BAYLOR_PDF ? KEEP : null),
  (p) => (p === CV_PDF ? moved("/about") : null),
  (p) => (p.startsWith("/wp-content/uploads/") ? GONE : null),
];

/** Explicit rows, keyed by the old path without its trailing slash. */
const ROWS = /** @type {Record<string, string>} */ ({
  "/knowledge-base/pcr-coi-lco1490-hco2198": "/research/protocols/coi-primers",
  "/virus-isolation": "/research/protocols/phage-isolation",
  "/phage-discovery": "/research/phage-discovery",
  "/wolbachia-project-genetic-techniques": "/research/wolbachia",
  "/research": "/research",
  "/knowledge-base/pcr-rev-3-ltr-8000-8297": "/research/protocols/rev-lpdv-primers",
  "/knowledge-base/pcr-rev-pol-2500-3750": "/research/protocols/rev-lpdv-primers",
  "/knowledge-base/pcr-pan-avian-gapdh": "/research/protocols/pan-avian-gapdh",
  "/knowledge-base/pcr-wolbachia-16s-rrna": "/research/protocols/wolbachia-16s",
  "/publications": "/research/publications",
  "/manuscripts": "/research/publications",
  "/knowledge-base/rev-lpdv-2018-2020-database": "/research/publications",
  "/virology-course": "/teaching",
  "/genetics-course": "/teaching",
  "/vaccines-course": "/teaching",
  "/cell-biology-course": "/teaching",
  "/lecture-courses": "/teaching",
  "/courses": "/teaching",
  "/related-courses": "/teaching",
  "/research-lab-courses": "/teaching",
  "/study-skills-guide": "/teaching",
  "/prospective-students": "/teaching",
  "/biomedical-sciences-academic-advising": "/teaching",
  "/teaching-philosophy": "/teaching",
  "/tarleton-biological-sciences-biomedical-sciences-and-biology": "/teaching",
  "/phages": "/research/phages",
  "/phage-archives": "/research/phages",
  "/microbiomes": "/research",
  "/laboratory": "/research",
  "/phage-bioinformatics": "/research/phage-discovery",
  "/phage-genetic-studies": "/research/phage-discovery",
  "/phage-discovery-application": "/research/phage-discovery",
  "/molarity-calculator": "/playground",
  "/knowledge-base/metric-prefix": "/playground",
  "/central-dogma-tutorials": "/playground",
  "/retroviruses": "/research/rev-lpdv",
  "/rev-lpdv-surveys": "/research/rev-lpdv",
  "/rev-lpdv-genetic-studies": "/research/rev-lpdv",
  "/knowledge-base": "/research/protocols",
  "/gentech-2018a": "/research/wolbachia",
  "/virus-isolation-reagent-request": "/research/protocols/phage-isolation",
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
  if (!disposition || disposition.status === "keep") return null;

  // A row that rebuilds a page at its own address (`/research/` to `/research`) redirects only the
  // slashed form; the bare form is the page, and redirecting it to itself would loop.
  if (disposition.status === 301 && disposition.location === pathname) return null;
  return disposition;
}
