// The trailing slash is load-bearing: Scholar requires citation_pdf_url in the same subdirectory as the
// abstract page, which only /publications/<slug>/ satisfies. The slug derives from the DOI, never the
// curated id, so it cannot be re-decided after Scholar has indexed it.

import { ASSET_PREFIX } from "../media/classify.mjs";

/**
 * Casefolded: DOIs are case-insensitive and some are deposited mixed case. The collapse is lossy, so
 * check:machine-readable asserts uniqueness.
 *
 * @param {string} doi as deposited
 * @returns {string}
 */
export function doiSlug(doi) {
  return String(doi ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const PUBLICATIONS_PATH = "/publications";

/**
 * @param {string} slug from `doiSlug`
 */
export function paperPath(slug) {
  return `${PUBLICATIONS_PATH}/${slug}/`;
}

/**
 * Named for the slug, not the curated filename, so one string decides both the directory and the file.
 *
 * @param {string} slug from `doiSlug`
 */
export function paperPdfPath(slug) {
  return `${PUBLICATIONS_PATH}/${slug}/${ASSET_PREFIX}${slug}.pdf`;
}

/**
 * @param {string} slug from `doiSlug`
 */
export function paperMarkdownPath(slug) {
  return `${PUBLICATIONS_PATH}/${slug}.md`;
}

/**
 * A link to /search, so it works without script. Only the quoted title: the classic index ANDs its terms,
 * so extra words return nothing. check:machine-readable asserts no title contains a quotation mark.
 *
 * @param {string} title DECODED, the way a reader sees it
 */
export function paperAskUrl(title) {
  return `/search?q=${encodeURIComponent(`"${title}"`)}`;
}

/**
 * @param {string} slug from `doiSlug`
 */
export function paperPdfDiskPath(slug) {
  return `public/publications/${slug}/${ASSET_PREFIX}${slug}.pdf`;
}
