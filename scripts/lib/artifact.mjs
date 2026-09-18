/**
 * The on-disk shape of the local content build product, with ONE writer.
 *
 * BOUNDARY: it lives beside the scripts rather than in the app because the Worker imports nothing
 * from it: the editor renders straight into D1 instead of through this shape.
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
   * `pages` is REQUIRED, and the throw is the point: hand-authored pages are in the search corpus,
   * so the records array is no longer derivable from the posts alone. A caller that forgot the
   * second argument would produce a SMALLER artifact that is internally consistent and passes every
   * shape check, and the gate would go red on the next ordinary build with a byte difference nobody
   * could place.
   */
  if (!Array.isArray(pages)) {
    throw new Error(
      "serializeArtifact needs the page inputs as its second argument. " +
        "Pass colophonPages(stack, features); without them the artifact would " +
        "silently omit every page record.",
    );
  }

  /*
   * `papers` IS REQUIRED FOR THE SAME REASON, and required rather than defaulted to an empty array
   * on purpose: a default is the failure above reintroduced, an artifact missing every paper,
   * internally consistent, and red on the next unrelated build.
   */
  if (!Array.isArray(papers)) {
    throw new Error(
      "serializeArtifact needs the publication inputs as its third argument. " +
        "Pass paperSearchInputs(PUBLICATIONS); without them the artifact would " +
        "silently omit every paper record.",
    );
  }

  // Records are derived here rather than stored per post, so adding a post cannot leave another
  // post's records stale, and each group is internally sorted so the order is stable across writers
  // and the gate never fails on ordering alone.
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
