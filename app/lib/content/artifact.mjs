/**
 * The on-disk shape of content/generated/posts.json.
 *
 * There are exactly two writers of this file: `scripts/build-content.mjs` and
 * the admin editor's save path. They must produce byte-identical output or
 * `check:content` goes red the first time the editor saves anything. Rather
 * than asking both to remember the same shape, both call this.
 *
 * That is the same lesson `withRelated` taught and then revision dates taught
 * again: anything the artifact carries is computed in ONE place that both
 * callers import, or it drifts.
 */

import { recordsForPosts } from "../search/records.mjs";

/**
 * @param {any[]} posts already ordered and with cross-post data applied
 * @returns {string}
 */
export function serializeArtifact(posts) {
  // Records are derived here rather than stored per post so that adding a post
  // cannot leave another post's records stale. They are a pure function of the
  // post list, so the gate compares them like everything else.
  return `${JSON.stringify({ posts, records: recordsForPosts(posts) }, null, 2)}\n`;
}
