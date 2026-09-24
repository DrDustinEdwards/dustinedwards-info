/**
 * The Ask item key mapping, for papers and for the posts it already carried.
 *
 * REPLAYS THE DEFECT the change that added papers to the index nearly shipped,
 * per the replay rule. `keyForUrl` was written for `/blog/<slug>`, which has no
 * trailing slash. A paper's page is `/publications/<slug>/` and the slash is
 * load-bearing (`citation_pdf_url` must sit in the page's own subdirectory), so
 * the untouched function produced `publications/<slug>/.md`: a key that names
 * no document, uploads without complaint, and cites a URL with a doubled slash
 * in it. Nothing in the type system or the linter can see that.
 *
 * The round trip is the property worth testing rather than either direction
 * alone. AI Search carries `item.key` and nothing else about a chunk's origin,
 * so the key IS the citation: the upload path writes it and the client chunk
 * reads it back through this same module, and the only failure that matters is
 * the two disagreeing.
 *
 * @see app/lib/search/ask-keys.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import { keyForUrl, labelForUrl, slugForKey, urlForKey } from "../app/lib/search/ask-keys.mjs";

test("a paper's key is its twin's own path", () => {
  assert.equal(
    keyForUrl("/publications/10-1128-mra-00888-24/"),
    "publications/10-1128-mra-00888-24.md",
  );
});

test("a paper's key maps back to the page, with the trailing slash", () => {
  // Not to the twin. A citation should land on the page that carries the
  // abstract, the PDF and the exports, and the slashed form is the canonical
  // one, so a citation costs no redirect.
  assert.equal(
    urlForKey("publications/10-1128-mra-00888-24.md"),
    "/publications/10-1128-mra-00888-24/",
  );
});

test("the paper round trip is stable", () => {
  const url = "/publications/10-3390-v3060861/";
  assert.equal(urlForKey(keyForUrl(url)), url);
});

test("a paper key with a section anchor is refused rather than guessed", () => {
  // A paper is indexed as ONE document, so no such key can be written by this
  // site. One arriving is an item from somewhere else, and a citation pointing
  // at an invented heading is worse than no citation.
  assert.equal(urlForKey("publications/10-3390-v3060861__abstract.md"), null);
});

test("a paper contributes no post slug to the visibility replay", () => {
  /*
   * The one caller asks D1 whether every cited POST is still public. A paper
   * has no row in `posts`: without the guard this asserts, the paper's URL fell
   * through the `/blog/` strip unchanged, was handed to `publiclyVisibleSlugs`
   * as a slug, matched nothing, and made every cached answer citing a paper
   * unreplayable forever, on a corpus that cannot be withdrawn.
   */
  assert.equal(slugForKey("publications/10-3390-v3060861.md"), null);
});

test("a paper's citation label names the identifier and says what it is", () => {
  // The chunk carries no title, and the slug is a LOSSY fold of the DOI, so a
  // reconstructed DOI would sometimes be wrong. An identifier a reader might
  // copy is not a place to guess.
  assert.equal(
    labelForUrl("/publications/10-1128-mra-00888-24/"),
    "Paper 10-1128-mra-00888-24",
  );
});

test("posts are unchanged by the trailing-slash strip", () => {
  // The strip is a general rule now, so the case it was NOT written for is
  // asserted too: a post URL has no trailing slash and must key and label
  // exactly as it did before papers existed.
  assert.equal(keyForUrl("/blog/a-post"), "blog/a-post.md");
  assert.equal(keyForUrl("/blog/a-post#a-heading"), "blog/a-post__a-heading.md");
  assert.equal(urlForKey("blog/a-post__a-heading.md"), "/blog/a-post#a-heading");
  assert.equal(slugForKey("blog/a-post__a-heading.md"), "a-post");
  assert.equal(labelForUrl("/blog/a-post#a-heading"), "A heading");
});

test("a key from another source is refused, not translated", () => {
  assert.equal(urlForKey("elsewhere/thing.md"), null);
  assert.equal(urlForKey("publications.md"), null);
  assert.equal(urlForKey("not-markdown"), null);
});
