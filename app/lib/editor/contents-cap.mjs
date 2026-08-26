/**
 * The Contents API 1 MB cap, as a pure decision `node:test` can drive.
 *
 * Renamed from artifact-limits.mjs when the committed artifact left the
 * repository: the artifact-sized readers died with it, and this survived
 * because the cap is a fact about EVERY per-file JSON-media-type read, not
 * about the artifact. `readFile` still guards markdown reads with it; a post
 * crossing 1 MB must fail naming the transport rather than surfacing
 * downstream as parse garbage.
 *
 * @see test/contents-cap.test.mjs
 */

/**
 * Why a Contents API JSON response cannot be decoded, or null if it can.
 *
 * The JSON media type returns files over 1 MB with `size` set and no base64
 * content (GitHub sends `encoding: "none"` and an empty string). `readFile`
 * used to decode that empty content to an empty string, so an oversized file
 * surfaced downstream as garbage with advice that repaired nothing: the file
 * was fine and the transport dropped it.
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
      `at 1 MB per file, so it came back without base64 content. A file this ` +
      `size cannot be read or saved through the editor's per-file reads.`
    );
  }
  return null;
}
