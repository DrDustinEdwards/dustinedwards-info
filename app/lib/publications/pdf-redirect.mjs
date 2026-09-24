/**
 * PERMANENT REDIRECTS FOR THE 31 PUBLICATION PDFs, WHICH ALL MOVED.
 *
 * ## WHY THEY MOVED
 *
 * They were flat: `/publications/edwards-2025-godfather.pdf`. Google Scholar's
 * technical guidelines say of `citation_pdf_url` that "for security reasons, it
 * must refer to a file in the same subdirectory as the HTML abstract", so a PDF
 * one level above its paper's page cannot be claimed by that page. Each file now
 * sits inside its paper's directory as
 * `/publications/<slug>/<slug>.pdf`.
 *
 * ## WHY THE OLD URLS STILL ANSWER
 *
 * Every one of them was public and served for seven weeks, and a published URL
 * is a promise. This is the same ruling `slug-redirect.mjs` was written under
 * (ruling 47) and the same reasoning: not because an inbound link was found,
 * but because the URLs existed.
 *
 * Nothing here is a 410. Ruling 63 and Grok's review called for the unlicensed
 * PDFs to stop being hosted, which would have made some of these Gone; Dustin
 * ruled on 2026-09-12 that all 31 stay up. So every old path has a destination
 * and this map has no absent-target case to represent.
 *
 * ## WHY IT IS A MAP AND NOT A RULE
 *
 * The old filename is the CURATED id (`edwards-2025-godfather`) and the new one
 * is derived from the DOI. There is no function from one to the other: the id
 * was chosen by a human against a banned-token list computed from the corpus.
 * So the pairs are data, generated once by the move and gated in both
 * directions by `check:machine-readable`, rather than a transformation somebody
 * would have to keep true.
 *
 * ## THE GATEWAY, NOT A ROUTE
 *
 * Same slot and the same argument as the post redirects. A `/publications/*`
 * path that is not a real asset falls through the static handler to the Worker
 * and would render the 404 page; deciding here costs no render and cannot be
 * stored, because the gateway is cache disabled. And the PDFs are served by the
 * asset handler AHEAD of the Worker, so a request for a file that still exists
 * never reaches this at all.
 *
 * The map is an ARGUMENT rather than an import, for the reason
 * `slug-redirect.mjs` gives at length: this module is imported both by the
 * Worker through vite and by `node --test` directly, and those two disagree
 * about JSON import attributes.
 */

/** The one place the prefix is spelled for this module. */
const PUBLICATIONS_PREFIX = "/publications/";

/**
 * Where a moved PDF now lives, or null if this module has no opinion.
 *
 * Returns a PATH, and the caller resolves it against the request's own origin,
 * so a redirect built here cannot be talked into naming another host.
 *
 * @param {string} pathname the request's pathname, already decoded by URL
 * @param {Record<string, string>} map old path to new path, both site-absolute
 * @returns {string | null}
 */
export function pdfRedirectTarget(pathname, map) {
  if (typeof pathname !== "string") return null;
  if (!map || typeof map !== "object") return null;
  /*
   * Scoped to the prefix before the lookup. Without it this module would answer
   * for any path that happened to be a key, which is a wider claim than it has
   * any business making and would make the map's contents load-bearing for the
   * whole site rather than for one directory.
   */
  if (!pathname.startsWith(PUBLICATIONS_PREFIX)) return null;

  /*
   * OWN PROPERTY ONLY, the same hazard `slug-redirect.mjs` documents: the map is
   * a plain object, so `constructor` and `toString` are inherited keys with
   * truthy values, and a bare lookup would issue a redirect to the source of
   * `Object` for a path that happened to spell one.
   */
  if (!Object.hasOwn(map, pathname)) return null;

  const target = map[pathname];
  if (typeof target !== "string" || target.length === 0) return null;
  // A target that is not in the same directory tree would mean the map has been
  // edited into something this module should not be serving.
  if (!target.startsWith(PUBLICATIONS_PREFIX)) return null;
  return target;
}

/**
 * 301 for GET and HEAD, 308 for everything else.
 *
 * Identical to `postRedirectStatus` on purpose. Nothing POSTs to a PDF, so the
 * distinction cannot bite here either; two redirect helpers in one Worker
 * answering the same question differently is how the next reader learns the
 * wrong rule.
 *
 * @param {string} method
 * @returns {number}
 */
export function pdfRedirectStatus(method) {
  const m = String(method ?? "").toUpperCase();
  return m === "GET" || m === "HEAD" ? 301 : 308;
}

/**
 * Whether a path is the slashless spelling of a paper page.
 *
 * `/publications/<slug>` and `/publications/<slug>/` both match the route and
 * both render, which is two URLs for one document. The trailing-slash form is
 * canonical because it is the one that puts the page in the same subdirectory
 * as its PDF, so the other redirects to it.
 *
 * Returns null for the index itself, for anything with a further slash in it,
 * and for anything that looks like a file, which is what keeps this from
 * catching `/publications/<slug>/<slug>.pdf` on its way to the asset handler.
 *
 * @param {string} pathname
 * @returns {string | null} the canonical path, or null
 */
export function paperSlashTarget(pathname) {
  if (typeof pathname !== "string") return null;
  if (!pathname.startsWith(PUBLICATIONS_PREFIX)) return null;
  const rest = pathname.slice(PUBLICATIONS_PREFIX.length);
  if (rest.length === 0) return null;
  if (rest.includes("/")) return null;
  // A dot means a filename, and a filename under this prefix is an asset.
  if (rest.includes(".")) return null;
  return `${pathname}/`;
}
