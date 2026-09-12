/**
 * The mapping between a search record and its AI Search item key.
 *
 * Plain .mjs, imported by BOTH the server module that uploads the corpus and
 * the client chunk that renders citations, exactly as `records.mjs` is imported
 * by both writers and `query.mjs` by the route and the gate. A citation URL
 * derived one way on upload and another way on render is the kind of drift that
 * points readers at headings that do not exist, so there is one implementation.
 *
 * AI Search identifies a source chunk by `item.key` and carries nothing else
 * about where it came from, so the key IS the citation.
 */

/**
 * Separates slug from heading anchor inside an item key.
 *
 * Slugs and heading anchors are lowercase kebab, so a DOUBLE underscore cannot
 * occur inside either. A single underscore can: a heading like
 * `posts_fts and triggers` produces exactly that, on a blog that talks about
 * fts5 constantly. The upload path asserts the separator is absent rather than
 * trusting this note.
 */
export const KEY_SEPARATOR = "__";

/**
 * The item key for a record URL.
 *
 * ## THE TRAILING SLASH IS STRIPPED, WHICH IS WHAT MAKES A PAPER'S KEY ITS TWIN
 *
 * A paper's page is `/publications/<slug>/` and the slash is load-bearing
 * there: `citation_pdf_url` must sit in the page's own subdirectory, and
 * `paths.mjs` carries the whole argument. Left in place it would produce the
 * key `publications/<slug>/.md`, which names nothing.
 *
 * Stripped, the key is `publications/<slug>.md`, which is EXACTLY the twin's
 * own URL. So the key is not an encoding of the page path, it is the path of
 * the document that was uploaded, which is what a key is supposed to be. The
 * asymmetry with `urlForKey` is deliberate and is stated there: what goes in is
 * the twin, what comes back out is the page, because a citation should send a
 * reader to the page and not to its markdown source.
 *
 * @param {string} url `/blog/<slug>`, `/blog/<slug>#<anchor>` or `/publications/<slug>/`
 * @returns {string} `blog/<slug>.md`, `blog/<slug>__<anchor>.md` or `publications/<slug>.md`
 */
export function keyForUrl(url) {
  const [path, anchor] = url.replace(/^\//, "").replace(/\/$/, "").split("#");
  return anchor ? `${path}${KEY_SEPARATOR}${anchor}.md` : `${path}.md`;
}

/**
 * The site URL an item key came from.
 *
 * Returns null rather than a guess for a key this site did not write. An
 * instance can hold items from another source, and a citation pointing at a URL
 * that does not exist is worse than a citation that is absent.
 *
 * @param {string} key
 * @returns {string | null}
 */
export function urlForKey(key) {
  if (typeof key !== "string" || !key.endsWith(".md")) return null;
  const withoutExtension = key.slice(0, -3);
  const parts = withoutExtension.split(KEY_SEPARATOR);
  if (parts.length > 2) return null;
  const [path, anchor] = parts;
  // A split always yields a first element, so this refuses a genuinely empty
  // path rather than substituting one.
  if (!path) return null;
  /*
   * A PAPER'S CITATION POINTS AT THE PAGE, NOT AT THE TWIN.
   *
   * The uploaded document is `publications/<slug>.md`, so that is the key. What
   * a reader should be sent to is `/publications/<slug>/`: the page with the
   * abstract, the links, the PDF and the citation exports on it. Sending them
   * to the markdown source instead would be citing the plumbing.
   *
   * The trailing slash is restored because it is the canonical form; the
   * slashless spelling redirects, and a citation that costs a redirect is a
   * citation written wrong. Papers carry no anchor: a paper is indexed as one
   * document, so there is no heading to deep-link to.
   */
  if (path.startsWith("publications/")) return anchor ? null : `/${path}/`;
  if (!path.startsWith("blog/")) return null;
  return anchor ? `/${path}#${anchor}` : `/${path}`;
}

/**
 * The post slug an item key came from, or null.
 *
 * The same mapping as `urlForKey`, reduced to the identifier D1 stores, so a
 * caller can ask whether the post behind a citation is still public without
 * re-parsing a URL that this module just built. Finding B010 needs exactly
 * that on the cached-answer replay path.
 *
 * @param {string} key
 * @returns {string | null}
 */
export function slugForKey(key) {
  const url = urlForKey(key);
  if (!url) return null;
  /*
   * POSTS ONLY, and the guard is load-bearing since papers entered the index.
   *
   * The one caller is the visibility check on the cached-answer replay path,
   * which asks D1 whether every cited POST is still public. A paper has no row
   * in `posts` and no draft state: it is committed data, published by existing.
   * Without this guard `/publications/<slug>/` would fall through the `/blog/`
   * strip unchanged and be handed to `publiclyVisibleSlugs` as a slug, which
   * would find nothing and mark every answer citing a paper unreplayable
   * forever, on a corpus that cannot be withdrawn.
   *
   * Null is the right answer rather than a workaround: the question is "which
   * posts does this cite", and the answer for a paper chunk is none.
   */
  if (!url.startsWith("/blog/")) return null;
  const slug = (url.split("#")[0] ?? "").replace(/^\/blog\//, "");
  return slug.length > 0 ? slug : null;
}

/**
 * A readable label for a citation.
 *
 * The heading text is not carried on the chunk, so the anchor is un-slugged.
 * This is a LABEL, not data. The link is the part that has to be right.
 *
 * @param {string} url
 * @returns {string}
 */
export function labelForUrl(url) {
  const [path, anchor] = url.split("#");
  /*
   * A PAPER IS LABELLED WITH ITS SLUG, DELIBERATELY, AND NOT WITH A DOI.
   *
   * The chunk carries `item.key` and nothing else, so there is no title here to
   * show. The slug is the DOI with every run of punctuation folded to a hyphen,
   * and that fold is LOSSY: `10-1128-mra-00888-24` could unfold to
   * `10.1128/mra.00888-24` or `10.1128/mra-00888.24`, and this cannot tell
   * which. A DOI is an identifier a reader may copy, so a plausible
   * reconstruction is worse than none.
   *
   * So the identifier is shown as it is, with a word saying what it identifies.
   * The word also stops two paper citations reading as one thing. The link is
   * the part that has to be right, and it is.
   */
  if ((path ?? "").startsWith("/publications/")) {
    return `Paper ${(path ?? "").replace(/^\/publications\//, "").replace(/\/$/, "")}`;
  }
  const target = anchor ?? (path ?? "").replace(/^\/blog\//, "");
  const words = target
    .replace(/^\d+-/, "")
    .split("-")
    .filter(Boolean);
  if (words.length === 0) return "Untitled";
  return words.join(" ").replace(/^./, (c) => c.toUpperCase());
}
