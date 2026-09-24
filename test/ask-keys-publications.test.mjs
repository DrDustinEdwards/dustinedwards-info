/* A paper's page is `/publications/<slug>/` and its slash is load-bearing. AI Search carries
 * only `item.key`, so the key IS the citation and the round trip is the property that matters. */

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
  /* A paper has no row in `posts`: without this guard its URL would reach
   * `publiclyVisibleSlugs` as a slug and make every cached answer citing a paper unreplayable. */
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
  // The strip is a general rule, so a post URL, which has no trailing slash, must key and
  // label exactly as before.
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
