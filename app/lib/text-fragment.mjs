/**
 * A URL text fragment (`#:~:text=`) for a passage a reader has selected.
 *
 * SEPARATE FROM THE ENHANCEMENT THAT USES IT BECAUSE THE ENCODING IS THE HALF THAT FAILS SILENTLY.
 * A mis-encoded directive still produces a URL that loads the page; it just highlights nothing, and
 * nothing about the page is wrong afterwards to look at. As a pure function over a string it can be
 * asserted character by character.
 */

/**
 * Below this a fragment is a liability rather than a link. The directive matches the FIRST
 * occurrence in the document, so a short phrase can land a reader on a paragraph they did not pick.
 */
export const FRAGMENT_MIN_CHARS = 12;

/** Above this the exact form gives way to the `start,end` range form. */
export const FRAGMENT_MAX_CHARS = 200;

/** Words taken from each end when the range form is used. */
export const FRAGMENT_EDGE_WORDS = 6;

/**
 * The characters the directive's own grammar reserves. `encodeURIComponent` already escapes the
 * comma and the ampersand; the HYPHEN is the one it leaves, and a hyphen inside a passage turns
 * everything after it into a suffix match against a document that has no such suffix.
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
   * THE RANGE FORM IS NOT AN OPTIMISATION. A selection crossing a block boundary can never match as
   * one exact string, because the directive matches inside a block, and `Selection` spells that
   * boundary as a newline. Long passages take the range form too: a whole paragraph in a URL is
   * fragile against every whitespace difference between the renderer and the reader's browser.
   */
  if (edge > 0 && (text.length > FRAGMENT_MAX_CHARS || text.includes("\n"))) {
    return `${encodePart(words.slice(0, edge).join(" "))},${encodePart(words.slice(-edge).join(" "))}`;
  }
  return encodePart(text);
}
