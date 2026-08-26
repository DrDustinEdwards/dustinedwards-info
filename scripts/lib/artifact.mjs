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

import { recordsForPages, recordsForPosts } from "../../app/lib/search/records.mjs";

/**
 * @param {any[]} posts already ordered and with cross-post data applied
 * @param {any[]} pages hand-authored page inputs, from `colophonPages()`
 * @returns {string}
 */
export function serializeArtifact(posts, pages) {
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

  // Records are derived here rather than stored per post so that adding a post
  // cannot leave another post's records stale. They are a pure function of the
  // post list and the page inputs, so the gate compares them like everything
  // else. Posts first, then pages, each internally sorted, so the order is
  // stable across writers and `check:content` never fails on ordering alone.
  return `${JSON.stringify(
    {
      posts,
      records: [...recordsForPosts(posts), ...recordsForPages(pages)],
    },
    null,
    2,
  )}\n`;
}
