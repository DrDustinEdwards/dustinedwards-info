// A paper's canonical URL is the slash form, because Google Scholar honors `citation_pdf_url` only when the
// PDF sits in the abstract page's own subdirectory. Not a move: the slashless form was never the page.

const PUBLICATIONS_PREFIX = "/research/publications/";

// The HTTPS redirect's own rule, so the redirect helpers never disagree.
export { httpsRedirectStatus as pdfRedirectStatus } from "../https-redirect.mjs";

/**
 * Skips anything with a dot so the PDF inside the directory still reaches the asset handler.
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
  if (rest.includes(".")) return null;
  return `${pathname}/`;
}
