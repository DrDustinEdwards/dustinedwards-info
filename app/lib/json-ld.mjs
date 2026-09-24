/**
 * `<script>` contents are raw text ended only by a literal `</script`, so a
 * value containing it would close the element early. U+2028/9 are escaped
 * because they are line terminators if this is ever read as JavaScript.
 * The escapes parse back to identical data, so they are safe on every emitter.
 */

// Built from strings: a literal U+2028 is invisible and does not survive a copy.
const LINE_SEPARATOR = new RegExp("\\u2028", "g");
const PARAGRAPH_SEPARATOR = new RegExp("\\u2029", "g");

/**
 * @param {unknown} value
 * @returns {string}
 */
export function jsonLd(value) {
  return (
    JSON.stringify(value)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026")
      .replace(LINE_SEPARATOR, "\\u2028")
      .replace(PARAGRAPH_SEPARATOR, "\\u2029")
  );
}
