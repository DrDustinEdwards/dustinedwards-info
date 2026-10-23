// The site's link rules on top of Prelum's URL policy (@drdustinedwards/site-helpers/render/url), which
// stays the one protocol check: these compose with isAllowedUrl, never replace it.

import { SLUG_PATTERN } from "./slug.mjs";

const INTERNAL_LINK_PREFIX = "/writing/";

/**
 * Composed with isAllowedUrl, never instead of it. The protocol is checked explicitly because the URL
 * constructor parses mailto:, which is not further reading.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isFurtherReadingUrl(value) {
  if (value.startsWith(INTERNAL_LINK_PREFIX)) return internalLinkSlug(value) !== null;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === "https:" || parsed.protocol === "http:";
}

/**
 * Exported so check:content resolves internal links without a second copy of the prefix rule.
 *
 * @param {string} value
 * @returns {string | null}
 */
export function internalLinkSlug(value) {
  if (!value.startsWith(INTERNAL_LINK_PREFIX)) return null;
  const slug = value.slice(INTERNAL_LINK_PREFIX.length);
  return SLUG_PATTERN.test(slug) ? slug : null;
}
