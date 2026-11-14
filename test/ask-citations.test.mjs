/* AI Search carries a chunk's D1 row id as `row_id`, and the Ask index's ids are URLs, so the row id IS the citation.
 * A paper's page is `/research/publications/<slug>/` and its slash is load-bearing. */

import test from "node:test";
import assert from "node:assert/strict";

import {
  labelForUrl,
  rowIdOf,
  slugForRowId,
  urlForRowId,
} from "../app/lib/search/ask-citations.mjs";

await test("a citation is read from the chunk's row_id, never its item key", () => {
  // The key is a sanitized prefix plus a hash for any id holding "/" or "#", so it cannot be mapped back.
  const chunk = {
    item: {
      key: "_writing_a-post_a-heading-1a2b3c4d5e6f7a8b.md",
      metadata: { row_id: "/writing/a-post#a-heading" },
    },
  };
  assert.equal(rowIdOf(chunk), "/writing/a-post#a-heading");
  assert.equal(rowIdOf({ item: { key: "writing/a-post.md" } }), "");
  assert.equal(rowIdOf(null), "");
});

await test("every part of a paper cites the paper's page, with the trailing slash", () => {
  // Not the twin: a citation lands on the page that carries the abstract, the PDF and the exports.
  assert.equal(
    urlForRowId("/research/publications/10-1128-mra-00888-24/"),
    "/research/publications/10-1128-mra-00888-24/",
  );
  assert.equal(
    urlForRowId("/research/publications/10-3389-feduc-2023-1279921/#part-3"),
    "/research/publications/10-3389-feduc-2023-1279921/",
  );
});

await test("a post or one of its sections cites itself, and names its post", () => {
  assert.equal(urlForRowId("/writing/a-post"), "/writing/a-post");
  assert.equal(urlForRowId("/writing/a-post#a-heading"), "/writing/a-post#a-heading");
  assert.equal(slugForRowId("/writing/a-post#a-heading"), "a-post");
  assert.equal(labelForUrl("/writing/a-post#a-heading"), "A heading");
});

await test("a paper contributes no post slug to the visibility replay", () => {
  /* A paper has no row in `posts`: without this guard its URL would reach
   * `publiclyVisibleSlugs` as a slug and make every cached answer citing a paper unreplayable. */
  assert.equal(slugForRowId("/research/publications/10-3390-v3060861/"), null);
});

await test("an id this site's query cannot produce is refused, not translated", () => {
  assert.equal(urlForRowId("/research/publications/10-3390-v3060861/#abstract"), null);
  assert.equal(urlForRowId("/research/publications/10-3390-v3060861"), null);
  assert.equal(urlForRowId("/elsewhere/thing"), null);
  assert.equal(urlForRowId("writing/a-post.md"), null);
  assert.equal(urlForRowId(""), null);
});

await test("a paper's citation label names the identifier and says what it is", () => {
  // The chunk carries no title, and the slug is a LOSSY fold of the DOI, so a reconstructed DOI would sometimes be
  // wrong. An identifier a reader might copy is not a place to guess.
  assert.equal(
    labelForUrl("/research/publications/10-1128-mra-00888-24/"),
    "Paper 10-1128-mra-00888-24",
  );
});
