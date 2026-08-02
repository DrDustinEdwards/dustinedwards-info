/**
 * Word count and reading time, for the pipeline AND for the editor.
 *
 * This is a module of its own for the reason `records.mjs` and `ask-keys.mjs`
 * are: two places need the same derivation and there must be exactly one of it.
 * The published page says "9 min read" from a number the build computed, and
 * the editor now shows a reading time as the author types. If those two used
 * different arithmetic, the editor would promise a number the post would not
 * carry, which is worse than showing nothing.
 *
 * It is SPLIT OUT of pipeline.mjs rather than imported from it, and that is the
 * whole point of the file. `pipeline.mjs` pulls shiki and its grammars, which is
 * most of a megabyte, and the editor's chunk runs in the browser. Importing the
 * pipeline to reach a constant and a division would have put the entire
 * markdown renderer in a client bundle, against the repo's bundle-leanness
 * rule. This module has no imports at all.
 */

/**
 * The stated rate. ONE declaration for the whole site.
 *
 * 200 is the value the corpus was already built with, so it is inherited rather
 * than chosen here: changing it would silently restate the reading time of
 * every published post the next time the artifact is regenerated.
 */
export const WORDS_PER_MINUTE = 200;

/**
 * Words in a markdown source.
 *
 * Whitespace-separated tokens, which counts markdown syntax as words: a fenced
 * code block and a link's URL both add to the total. That is deliberate, not an
 * oversight to fix later. It is the count the published `reading_time_minutes`
 * was computed with, and the editor's job here is to agree with the site rather
 * than to be independently clever about prose.
 *
 * @param {string} markdownText
 * @returns {number}
 */
export function countWords(markdownText) {
  return markdownText.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Minutes for a count already taken.
 *
 * Exists so the editor, which counts words on every keystroke to display them,
 * does not have to count them a second time to get a reading time, and more
 * importantly does not have to restate the division to avoid doing so. The
 * formula lives here once.
 *
 * Never zero, because "0 min read" on a post that has words in it reads as a
 * bug. An EMPTY document is the one case that legitimately has no reading time,
 * and the caller is expected to render nothing rather than ask for it.
 *
 * @param {number} words
 * @returns {number}
 */
export function minutesForWords(words) {
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/**
 * Estimated reading time in whole minutes, never less than one.
 *
 * @param {string} markdownText
 * @returns {number}
 */
export function readingTimeMinutes(markdownText) {
  return minutesForWords(countWords(markdownText));
}
