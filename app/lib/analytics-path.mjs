// A preview path carries a live capability token, and Analytics Engine rows are
// immutable, so the token must never reach the dataset.

// A route pattern rather than "[redacted]", which would invite a hunt for the original.
export const PREVIEW_PATH_LABEL = "/preview/:token";

const PREVIEW_PREFIX = "/preview/";

/**
 * Knows about exactly one route on purpose: a scrubber that guessed which
 * segments look secret would be silently wrong in both directions.
 *
 * @param {string} pathname
 * @returns {string} the pathname, or the preview label
 */
export function analyticsPath(pathname) {
  if (typeof pathname !== "string") return "";
  return pathname.startsWith(PREVIEW_PREFIX) ? PREVIEW_PATH_LABEL : pathname;
}

/**
 * Deliberately not used by `analyticsPath`: a rule and its check written as one
 * function can never disagree, so the check could never catch the rule.
 *
 * @param {string} stored
 * @returns {boolean}
 */
export function carriesPreviewToken(stored) {
  return typeof stored === "string" && /\/preview\/[A-Za-z0-9_-]{43}/.test(stored);
}
