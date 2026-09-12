/**
 * The on-disk shape of the local content build product.
 *
 * ONE writer since the artifact arc: `scripts/build-content.mjs`, whose output
 * is a gitignored local file that sync-content, the gates and the OG and
 * diagram builders read after building it. The admin editor no longer writes
 * or reads this shape; it renders straight into D1 through `renderAndWrite`.
 * Moved from app/lib/content/ to scripts/lib/ with that change, because the
 * Worker imports nothing from it any more.
 */

import {
  recordsForPages,
  recordsForPapers,
  recordsForPosts,
} from "../../app/lib/search/records.mjs";

/**
 * @param {any[]} posts already ordered and with cross-post data applied
 * @param {any[]} pages hand-authored page inputs, from `colophonPages()`
 * @param {any[]} papers publication inputs, from `paperSearchInputs()`
 * @returns {string}
 */
export function serializeArtifact(posts, pages, papers) {
  /*
   * `pages` is REQUIRED, and the throw is the point.
   *
   * Ruling 3 of colophon-page.md put hand-authored pages in the search corpus,
   * so the records array is no longer derivable from `posts` alone. A caller
   * that forgot the second argument would produce a SMALLER artifact that is
   * internally consistent and passes every shape check, and `check:content`
   * would then go red on the next ordinary build with a byte difference nobody
   * could place. Failing here names it instead.
   *
   * The two callers, `scripts/build-content.mjs` and the editor's save path,
   * differ only in how they LOAD the JSON that feeds `colophonPages()`. The
   * assembly itself lives in one place, for the reason this whole module exists.
   */
  if (!Array.isArray(pages)) {
    throw new Error(
      "serializeArtifact needs the page inputs as its second argument. " +
        "Pass colophonPages(stack, features); without them the artifact would " +
        "silently omit every page record.",
    );
  }

  /*
   * `papers` IS REQUIRED FOR THE SAME REASON, and it is required rather than
   * defaulted to an empty array on purpose. A default is the exact failure the
   * paragraph above describes, reintroduced: a caller that forgot it would
   * produce an artifact missing 36 records, internally consistent, passing
   * every shape check, and red on the next unrelated build.
   */
  if (!Array.isArray(papers)) {
    throw new Error(
      "serializeArtifact needs the publication inputs as its third argument. " +
        "Pass paperSearchInputs(PUBLICATIONS); without them the artifact would " +
        "silently omit every paper record.",
    );
  }

  // Records are derived here rather than stored per post so that adding a post
  // cannot leave another post's records stale. They are a pure function of the
  // post list, the page inputs and the paper inputs, so the gate compares them
  // like everything else. Posts, then pages, then papers, each internally
  // sorted, so the order is stable across writers and `check:content` never
  // fails on ordering alone.
  return `${JSON.stringify(
    {
      posts,
      records: [
        ...recordsForPosts(posts),
        ...recordsForPages(pages),
        ...recordsForPapers(papers),
      ],
    },
    null,
    2,
  )}\n`;
}
