/**
 * COinS: one machine-readable citation per row, for Zotero and its relatives.
 *
 * ## WHAT IT IS
 *
 * An empty `<span class="Z3988" title="...">` whose title is a URL-encoded
 * OpenURL ContextObject. Zotero, Mendeley and the browser extensions that
 * descend from them scan a page for `.Z3988` and offer to save what they find.
 * It is a 2006 convention and it is still the thing those tools actually
 * implement, which is the only reason to prefer it to anything tidier.
 *
 * ## INDEX ONLY, WHICH IS RULING 63's CALL AND IS ALSO CORRECT
 *
 * The per-paper pages carry Highwire `citation_*` tags and ScholarlyArticle
 * JSON-LD, both of which every modern tool reads and both of which say more.
 * COinS on those pages would be a third statement of the same facts on a page
 * that already has two.
 *
 * On the INDEX it is the only machine-readable form available: 33 records on
 * one page cannot each have a `citation_title`, because those tags describe the
 * document they sit in and a page can only be one document. That is the whole
 * reason Scholar refuses to index a list page, and it is exactly the gap COinS
 * fills: a saver can take one row without visiting it.
 *
 * ## THE SPAN IS EMPTY AND MUST STAY EMPTY
 *
 * Zotero reads the `title` attribute. Anything between the tags is rendered
 * text that no reader asked for, and the convention's own documentation says to
 * leave it empty. React renders `<span />` as `<span></span>`, which is what is
 * wanted.
 */

import { canonicalAuthor } from "./exports.mjs";
import { decodeEntities } from "./entities.mjs";

/** The genre each curated type maps to in the OpenURL journal schema. */
const GENRE = {
  article: "article",
  review: "article",
  abstract: "conference",
  chapter: "bookitem",
  "teaching-resource": "document",
};

/**
 * The ContextObject for one paper, as the `title` attribute's value.
 *
 * Key order is FIXED and is the order below rather than the record's, so the
 * output is a pure function of the values. `check:publications` compares two
 * generations byte for byte and an object-key iteration order that depended on
 * how a record was built would make that comparison meaningless.
 *
 * @param {any} paper
 * @returns {string}
 */
export function coinsTitle(paper) {
  /** @type {[string, string][]} */
  const pairs = [
    ["ctx_ver", "Z39.88-2004"],
    ["rft_val_fmt", "info:ofi/fmt:kev:mtx:journal"],
    ["rft.genre", GENRE[/** @type {keyof typeof GENRE} */ (paper.type)] ?? "article"],
    ["rft.atitle", decodeEntities(paper.title)],
  ];
  if (paper.journal) pairs.push(["rft.jtitle", decodeEntities(paper.journal)]);
  if (paper.year) pairs.push(["rft.date", String(paper.year)]);
  if (paper.volume) pairs.push(["rft.volume", String(paper.volume)]);
  if (paper.issue) pairs.push(["rft.issue", String(paper.issue)]);
  if (paper.firstPage) pairs.push(["rft.spage", paper.firstPage]);
  if (paper.lastPage) pairs.push(["rft.epage", paper.lastPage]);
  /*
   * `rft.au` ONCE PER AUTHOR, in order. The OpenURL key/value format repeats a
   * key rather than joining values, the same shape `citation_author` uses, and
   * for the same reason: a joined string becomes one author with a very long
   * name. This corpus would make that vivid at 144 names.
   */
  for (const name of paper.authors ?? []) {
    pairs.push(["rft.au", canonicalAuthor(name)]);
  }
  if (paper.doi) {
    // `info:doi/` is the identifier form OpenURL specifies. Bare DOIs in
    // `rft_id` are common and are not what the spec says.
    pairs.push(["rft_id", `info:doi/${paper.doi}`]);
  }

  /*
   * `encodeURIComponent`, NOT `URLSearchParams`. The latter encodes a space as
   * `+`, which is correct for a form body and wrong here: this string is read
   * as a URI query component, where `+` is a literal plus sign. A title
   * containing a space would come back to Zotero with plus signs in it.
   */
  return pairs
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}
