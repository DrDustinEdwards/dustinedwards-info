/**
 * Content types that get no CSP: a feed or sitemap is parsed, never rendered as a document (a PDF is shown by the
 * browser's own viewer), so a policy there is bytes on every shared-cached response that protect nothing. Named
 * types, never a negation of text/html, so an unforeseen document type keeps its policy. Safe only while
 * `nosniff` stays on every response.
 */

/** @type {ReadonlySet<string>} */
export const UNPOLICED_TYPES = new Set([
  "application/rss+xml",
  "application/atom+xml",
  "application/json",
  "application/xml",
  // The CV PDF (app/routes/cv-pdf.ts). Its address was a static asset, which carried no policy, and a policy on
  // a PDF protects nothing (it is no page of this site) while a `sandbox` or `object-src` directive can stop the
  // browser's own PDF viewer from opening it.
  "application/pdf",
]);

/**
 * @param {string | null} contentType
 * @returns {boolean}
 */
export function isUnpolicedType(contentType) {
  if (!contentType) return false;
  const type = (contentType.split(";")[0] ?? "").trim().toLowerCase();
  return UNPOLICED_TYPES.has(type);
}
