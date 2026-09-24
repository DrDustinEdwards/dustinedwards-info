// The directive matches the first occurrence, so a short phrase can land on the wrong paragraph.
export const FRAGMENT_MIN_CHARS = 12;

export const FRAGMENT_MAX_CHARS = 200;

export const FRAGMENT_EDGE_WORDS = 6;

/**
 * `encodeURIComponent` leaves the hyphen, which the directive reserves: an unescaped one turns the
 * rest of the passage into a suffix match.
 *
 * @param {string} text
 */
const encodePart = (text) => encodeURIComponent(text).replace(/-/g, "%2D");

/**
 * @param {string} selected raw selected text, as `Selection.toString()` yields it
 * @returns {string | null} the value for `#:~:text=`, or null when the selection is too short
 */
export function textFragment(selected) {
  const text = selected.trim().replace(/[^\S\n]+/g, " ");
  if (text.length < FRAGMENT_MIN_CHARS) return null;

  const words = text.split(/\s+/);
  const edge = Math.min(FRAGMENT_EDGE_WORDS, words.length >> 1);

  /*
   * A selection crossing a block boundary (a newline from `Selection`) never matches as one exact
   * string, and long passages are fragile against whitespace differences, so both use the range form.
   */
  if (edge > 0 && (text.length > FRAGMENT_MAX_CHARS || text.includes("\n"))) {
    return `${encodePart(words.slice(0, edge).join(" "))},${encodePart(words.slice(-edge).join(" "))}`;
  }
  return encodePart(text);
}
