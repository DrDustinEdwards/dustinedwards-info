/**
 * The size limits that govern reading the committed artifact from GitHub.
 *
 * `.mjs` and dependency-free so three readers share one statement:
 * `github.server.ts` enforces both limits on the wire, `check-content.mjs`
 * refuses an artifact drifting toward the ceiling, and `node:test` drives the
 * cap guard with stubbed responses (test/artifact-limits.test.mjs).
 */

/**
 * GitHub's documented limit for the raw media type on the Contents endpoint:
 * 100 MB. Above 1 MB the JSON media type stops carrying content; between 1 MB
 * and 100 MB the raw media type still serves the bytes; above 100 MB nothing
 * on the Contents endpoint does.
 *
 * STATED PLAINLY: Worker memory binds EARLIER than this ceiling and is
 * unmeasured. A Worker holds the response text, the parsed object and the
 * re-serialised artifact at once inside a 128 MB isolate, so the real limit is
 * some unknown fraction of this number. The ceiling is GitHub's documented
 * fact, the one that can be cited; the half-ceiling refusal in check:content
 * exists precisely because the true bound sits somewhere below and nobody has
 * measured where.
 */
export const ARTIFACT_READ_CEILING_BYTES = 100 * 1024 * 1024;

/**
 * Why a Contents API JSON response cannot be decoded, or null if it can.
 *
 * The JSON media type returns files over 1 MB with `size` set and no base64
 * content (GitHub sends `encoding: "none"` and an empty string). `readFile`
 * used to decode that empty content to an empty string, so an oversized file
 * surfaced downstream as "not valid JSON" with advice to rebuild the artifact,
 * which was a misdiagnosis: the artifact was fine and the transport dropped
 * it.
 *
 * Pure and message-producing rather than throwing, so the caller keeps its own
 * error type and `node:test` can assert the sentence without a GitHub binding.
 *
 * @param {{ size?: number, content?: string, encoding?: string }} file
 * @param {string} path for the message
 * @returns {string | null} the failure sentence, or null when the file is readable
 */
export function contentsCapMessage(file, path) {
  const size = file.size ?? 0;
  if (size > 0 && (file.encoding !== "base64" || (file.content ?? "").length === 0)) {
    return (
      `"${path}" is ${size} bytes and the Contents API's JSON media type caps ` +
      `at 1 MB per file, so it came back without base64 content. Read it ` +
      `through readRawFile, which uses the raw media type and carries files ` +
      `to GitHub's documented 100 MB.`
    );
  }
  return null;
}
