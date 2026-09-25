// Floors in front of the scripts that delete what the content artifact no longer names. Each of them
// converges a store toward the artifact, so an empty or reshaped artifact converges the store to nothing
// and then verifies that nothing against itself. These refuse before the delete instead.

/**
 * The artifact's posts, or a throw: `posts ?? []` is how an artifact with no posts key deleted
 * everything.
 *
 * @param {unknown} artifact the parsed content artifact
 * @param {string} from the file it was read from, named in the refusal
 * @returns {any[]}
 */
export function requirePosts(artifact, from) {
  const posts =
    artifact && typeof artifact === "object" ? /** @type {any} */ (artifact).posts : undefined;
  if (!Array.isArray(posts)) {
    throw new Error(
      `${from} carries no posts array. Run npm run build:content first; nothing was deleted.`,
    );
  }
  if (posts.length === 0) {
    throw new Error(
      `${from} carries zero posts. Converging to it would delete every post-derived row or ` +
        `object, so nothing was deleted. Run npm run build:content and check its output.`,
    );
  }
  return posts;
}

/**
 * Refuses a delete that removes more than it keeps. A real removal is one post or a handful; losing
 * more than half a store in one run is an artifact that collapsed, not an edit.
 *
 * @param {{ what: string, keeping: number, removing: number }} counts
 * @returns {string | null} the refusal, or null when the delete may go ahead
 */
export function deleteFloor({ what, keeping, removing }) {
  if (!Number.isInteger(keeping) || !Number.isInteger(removing) || keeping < 0 || removing < 0) {
    return (
      `the ${what} counts are unreadable (keeping=${keeping}, removing=${removing}), ` +
      `so the delete was refused`
    );
  }
  if (keeping === 0 && removing > 0) {
    return `the run would delete all ${removing} ${what} and keep none`;
  }
  if (removing > keeping) {
    return (
      `the run would delete ${removing} ${what} and keep only ${keeping}. More than half at once ` +
      `is a collapsed artifact, not an edit`
    );
  }
  return null;
}

/**
 * The per-post fields sync:content trusts. `mediaRefs ?? []` emptied media_refs, which disables the
 * guard against deleting a cited image, and a missing hash disables drift detection.
 *
 * @param {any[]} posts
 * @returns {string[]} one line per problem, empty when every post is whole
 */
export function syncablePostProblems(posts) {
  /** @type {string[]} */
  const problems = [];
  for (const [i, post] of posts.entries()) {
    const name = typeof post?.slug === "string" && post.slug ? post.slug : `posts[${i}]`;
    if (typeof post?.slug !== "string" || !post.slug) problems.push(`${name}: no slug`);
    if (typeof post?.sourcePath !== "string" || !post.sourcePath) {
      problems.push(`${name}: no sourcePath`);
    }
    if (!Array.isArray(post?.mediaRefs)) problems.push(`${name}: mediaRefs is not an array`);
    if (!Array.isArray(post?.tags)) problems.push(`${name}: tags is not an array`);
    if (typeof post?.sourceBlobSha !== "string" || !post.sourceBlobSha) {
      problems.push(`${name}: no sourceBlobSha`);
    }
    if (typeof post?.renderHash !== "string" || !post.renderHash) {
      problems.push(`${name}: no renderHash`);
    }
  }
  return problems;
}
