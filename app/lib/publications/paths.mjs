/**
 * EVERY URL AND EVERY FILE PATH THE PUBLICATION PAGES USE, STATED ONCE.
 *
 * Hard rule 6's shape, applied to a second corpus: `content/posts/<slug>.md` is
 * stated once by `postPath()`, and these are stated once here. Five consumers
 * need to agree about where a paper lives (the route, the sitemap, the exports,
 * the markdown twin and the build step that copies the PDFs), and the cost of
 * them disagreeing is a `citation_pdf_url` that points at nothing, which fails
 * silently and takes six to nine months to correct in Google Scholar.
 *
 * `.mjs` because the build scripts import it as well as the Worker, and this
 * repo's tsconfig and Node ESM cannot agree on a JSON import attribute. The
 * same split `slug-redirect.mjs` and `records.mjs` already live on.
 *
 * ## THE TRAILING SLASH IS LOAD-BEARING, WHICH IS NOT OBVIOUS
 *
 * Google Scholar's technical guidelines say of `citation_pdf_url`: "For security
 * reasons, it must refer to a file in the same subdirectory as the HTML
 * abstract." Read literally, and it is meant literally:
 *
 *     page /publications/10-1128-mra-00888-24      subdirectory /publications/
 *     pdf  /publications/10-1128-mra-00888-24/x.pdf subdirectory /publications/10-1128-mra-00888-24/
 *
 * Those differ, so the slashless page form and the nested PDF would NOT
 * satisfy the rule, and Scholar would decline the full text while indexing the
 * abstract. With the trailing slash the page's subdirectory IS the PDF's and
 * the rule is satisfied. So `/publications/<slug>/` is the canonical form, the
 * slashless spelling redirects to it in the gateway, and neither of those is a
 * style preference.
 *
 * ## THE SLUG IS DERIVED FROM THE DOI AND IS NEVER CHOSEN
 *
 * The corpus already carries a curated `id` per record (`edwards-2025-godfather`)
 * and it would make a prettier URL. It is deliberately NOT the slug, for one
 * reason: an id is a NAME somebody picked, and a name can be picked again. The
 * July build's own rename plan retitled files twice before freezing, and a
 * publication URL that is re-decidable is a URL that will eventually be
 * re-decided, after Scholar has indexed it.
 *
 * A DOI cannot be re-decided. It is assigned once by the registrant and is the
 * permanent identifier for the work, which makes a slug derived from it
 * permanent by construction rather than by discipline.
 */

/**
 * A DOI reduced to one URL path segment.
 *
 * CASEFOLDED, because DOI names are case-insensitive per the DOI spec and six
 * of the 36 in this corpus are mixed case as deposited (`10.1128/MRA.00558-21`).
 * Two spellings of one DOI must not become two URLs, and the one that survives
 * has to be the one a link can be written to by hand.
 *
 * Every run of characters that is not a letter or a digit becomes a single
 * hyphen, so `10.1128/mra.00888-24` becomes `10-1128-mra-00888-24`. The `/`,
 * the `.` and the existing `-` all fold to the same separator, which is what
 * makes the result a single path segment with no escaping anywhere in it.
 *
 * THE COLLAPSE IS LOSSY AND THAT IS WHY `check:publications` ASSERTS
 * UNIQUENESS. `10.1234/ab-cd` and `10.1234/ab.cd` produce the same slug. No
 * such pair exists in this corpus and the gate refuses one arriving, rather
 * than this function trying to be clever about a case that has never occurred.
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

/** The index. Also exported from `seo.ts`; this is the module build scripts reach for. */
export const PUBLICATIONS_PATH = "/publications";

/**
 * A paper's page, WITH the trailing slash. See the note above: the slash is
 * what puts the page and its PDF in one subdirectory for Scholar.
 *
 * @param {string} slug from `doiSlug`
 */
export function paperPath(slug) {
  return `${PUBLICATIONS_PATH}/${slug}/`;
}

/**
 * A paper's PDF, beside its page.
 *
 * Named for the slug rather than keeping the curated filename
 * (`edwards-2025-godfather.pdf`), so that one string decides both halves of the
 * pair. A directory named for the DOI holding a file named for the record would
 * be two identifiers for one thing, and the failure mode is the quiet one: the
 * page renders, the link works, and `citation_pdf_url` points into a directory
 * Scholar will not accept.
 *
 * @param {string} slug from `doiSlug`
 */
export function paperPdfPath(slug) {
  return `${PUBLICATIONS_PATH}/${slug}/${slug}.pdf`;
}

/**
 * A paper's markdown twin. Alongside the page, never inside its directory.
 *
 * @param {string} slug from `doiSlug`
 */
export function paperMarkdownPath(slug) {
  return `${PUBLICATIONS_PATH}/${slug}.md`;
}

/**
 * The /search URL that asks this paper's question.
 *
 * ## IT IS A LINK, AND THAT IS THE PROGRESSIVE ENHANCEMENT
 *
 * Ask lives on /search, where the classic keyword results render first from the
 * loader and the AI affordance is a nonced module script that unhides itself.
 * So a paper page does not need a button of its own: it needs a link that
 * arrives with the question already typed. Scripting off, the reader gets real
 * keyword results for this paper; scripting on, the same page offers to ask.
 * Rule 9's shape, with no second implementation of anything.
 *
 * ## THE QUESTION NAMES THE PAPER, BECAUSE `q` IS BOTH THINGS
 *
 * `/search?q=` is the keyword query AND the question Ask is given. "What does
 * this paper find?" is a question with no subject: Ask retrieves over the whole
 * site and cannot know which page the reader came from, and the keyword index
 * would match "paper" and "find" across the blog.
 *
 * The title in double quotes serves both readings at once. `query.mjs` reads a
 * quoted run as an exact phrase, which is the most precise keyword query
 * available for a paper whose search record carries its title; and the model
 * gets a question naming the work. No title in this corpus contains a quotation
 * mark, and `check:publications` asserts that rather than trusting it, because
 * one arriving would break the phrase for the classic index.
 *
 * @param {string} title DECODED, the way a reader sees it
 */
export function paperAskUrl(title) {
  return `/search?q=${encodeURIComponent(`What does "${title}" find?`)}`;
}

/**
 * Where the PDF sits on disk, relative to the repository root.
 *
 * The one statement of the `public/` half. `build-publications.mjs` copies into
 * this and `check:publications` reads it back, so a file that did not get
 * copied is a red gate rather than a 404 discovered by a reader.
 *
 * @param {string} slug from `doiSlug`
 */
export function paperPdfDiskPath(slug) {
  return `public/publications/${slug}/${slug}.pdf`;
}
