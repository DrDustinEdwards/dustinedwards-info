/**
 * Over 1 MB the Contents API JSON media type returns `size` with empty content and
 * `encoding: "none"`, which would otherwise decode silently to an empty file.
 *
 * @param {{ size?: number, content?: string, encoding?: string }} file
 * @param {string} path
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
