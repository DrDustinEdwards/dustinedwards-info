/**
 * THE ONE OWNER of "this byte count, as a size a person reads".
 *
 * Write-quality audit, the formatting nit. Two copies existed, in
 * `media-palette.tsx` and `admin.media._index.tsx`, and the palette's comment
 * said out loud what the duplication risked: "Same rounding the page uses, so a
 * size does not read two ways on one screen." The palette opens OVER that page,
 * so the two renderings of one object's size are visible at the same moment.
 * That comment was a promise held by nothing.
 *
 * A third site restated the conversion in prose rather than by calling either
 * copy: the upload refusal said `Math.round(size / 1024)` kB, and it only ever
 * runs when the file is over the 10 MB limit, so it always reported a
 * five-figure kilobyte number where the sentence's own next clause is in MB.
 *
 * ## WHAT THIS DOES NOT OWN
 *
 * The LIMIT'S own rendering. `MAX_BYTES / (1024 * 1024)` stays spelled out
 * where it appears, because the refusal reads exactly "That image is over the
 * 10 MB limit." and this function would make it "10.0 MB". The limit is a round number chosen by a person; a file's size is a
 * measurement. Formatting them with one function would be a coincidence of
 * units, not one fact.
 *
 * @see test/byte-size.test.mjs
 */

/**
 * Bytes as "812 B", "41 kB" or "2.4 MB".
 *
 * Units are decimal-prefixed but BINARY-DIVIDED, which is what the two copies
 * did and is preserved deliberately: changing it would silently restate every
 * size on the media page, and this change is about having one owner rather than
 * about picking a better rounding.
 *
 * @param {number} size
 * @returns {string}
 */
export function byteSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} kB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
