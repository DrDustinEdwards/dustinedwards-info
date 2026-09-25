/**
 * Content types that get no CSP: a feed or sitemap is parsed, never rendered as a document, and a
 * per-request nonce on a shared-cached body is served to every later reader. Named types, never a
 * negation of text/html, so an unforeseen document type keeps its policy. Safe only while
 * `nosniff` stays on every response.
 */

/** @type {ReadonlySet<string>} */
export const UNPOLICED_TYPES = new Set([
  "application/rss+xml",
  "application/atom+xml",
  "application/json",
  "application/xml",
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
