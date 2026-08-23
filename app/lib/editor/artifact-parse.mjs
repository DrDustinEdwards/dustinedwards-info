/**
 * Turning the committed artifact's bytes into a post list, or refusing.
 *
 * ## WHY THIS IS A MODULE AND NOT THREE LINES IN `loadArtifact`
 *
 * Every branch here is a decision that can be wrong in a way nothing notices,
 * and `loadArtifact` needs a GitHub binding to reach. Pure and separate, both
 * paths are drivable by `check:tests`: a missing file and a malformed one.
 *
 * ## THE CLASS THIS CLOSES
 *
 * Write-quality audit finding 14, which is hard rule 13's substituting-fallback
 * shape. `loadArtifact` answered a missing artifact with `[]`, and an empty
 * array is not "the file is missing", it is "there are no posts". Every caller
 * believed it. The worst consequence is not a blank page: `savePost` rebuilds
 * the WHOLE artifact from what this returns, so a save against a phantom empty
 * corpus commits an artifact holding one post and drops every other post from
 * the repository.
 *
 * @see app/lib/editor/publish.server.ts
 * @see test/artifact-parse.test.mjs
 */

/**
 * The posts in the artifact, or a thrown message naming the repair.
 *
 * THREE REFUSALS, and each is a state the old code read as an empty corpus:
 *
 *   - **file is null**: the artifact is absent from the repository. There is no
 *     never-built case to confuse this with: `readFile` returns null only on a
 *     GitHub 404, and `content/generated/posts.json` is tracked, committed and
 *     gated by `check:content`, so a clone has it. Null means deleted.
 *   - **not valid JSON**: unchanged behaviour, kept because it was already
 *     right.
 *   - **`posts` is not an array**: `{}` and `{"posts": null}` are malformed,
 *     and `?? []` read both as an empty corpus. `{"posts": []}` IS a legitimate
 *     empty corpus and is returned as one, which is the distinction the
 *     nullish coalescing could not make.
 *
 * @param {{ content: string } | null | undefined} file
 * @param {string} path for the message
 * @param {(message: string) => Error} makeError so the caller keeps its own error type
 * @returns {any[]}
 */
export function artifactPosts(file, path, makeError = (m) => new Error(m)) {
  if (!file) {
    throw makeError(
      `${path} is missing from the repository, so the corpus cannot be read. ` +
        `This is not an empty corpus and must not be treated as one: saving now ` +
        `would commit an artifact holding only the post being saved and drop every ` +
        `other post from it. Restore it by running 'npm run build:content' and ` +
        `committing the result.`,
    );
  }

  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(file.content);
  } catch {
    throw makeError(
      `${path} in the repository is not valid JSON, so it cannot be updated safely.`,
    );
  }

  const posts = /** @type {any} */ (parsed)?.posts;
  if (!Array.isArray(posts)) {
    throw makeError(
      `${path} parsed but carries no posts array, so the corpus cannot be read. ` +
        `An artifact with no posts key is malformed; an artifact with an empty ` +
        `posts array is a corpus with no posts, and those are different. Restore ` +
        `it by running 'npm run build:content' and committing the result.`,
    );
  }

  return posts;
}
