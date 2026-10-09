// The pages that must always be published (job_044f96426efa). /terms is the dataset license: TERMS_PATH
// is what the `Link: rel="license"` header on every download and the `license` of every Dataset point at,
// so a /terms that 404s or answers as a draft breaks the license of every data set the site publishes.
// Carrel already refuses to unpublish or delete it; this is the site's own refusal, in the doors every
// write and every sync goes through, so no client has to be trusted to carry the rule.

import { TERMS_PATH } from "../license.mjs";

/** @type {readonly string[]} */
export const PROTECTED_PAGE_PATHS = [TERMS_PATH];

/**
 * Why a page may not be unpublished or deleted, or null when it may. The sentence names the reason, so the
 * refusal a client sees says what the page is for.
 *
 * @param {string} path
 * @returns {string | null}
 */
export function protectedPageReason(path) {
  if (!PROTECTED_PAGE_PATHS.includes(path)) return null;
  return (
    `${path} is the license on every data set this site publishes (the Link rel="license" header on each ` +
    "download and the license of each Dataset point at it), so it can never be unpublished or deleted"
  );
}
