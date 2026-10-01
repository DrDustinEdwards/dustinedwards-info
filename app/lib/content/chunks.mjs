// D1 refuses a statement over 100 KB (SQLITE_TOOBIG), and a publication's twin with the PDF's full text
// passes it. A long text is therefore written in chunks, the first in the INSERT and the rest appended.
// scripts/sync-content.mjs and the Worker's publication write both split through here.

/** Characters per chunk: even at three UTF-8 bytes each, a chunk and its escaping stay well under 100 KB. */
export const CHUNK_CHARS = 25_000;

/**
 * @param {string} text
 * @returns {string[]} the text in order, never split inside a surrogate pair; one empty string for none
 */
export function textChunks(text) {
  /** @type {string[]} */
  const out = [];
  let at = 0;
  while (at < text.length) {
    let end = Math.min(at + CHUNK_CHARS, text.length);
    const last = text.charCodeAt(end - 1);
    if (end < text.length && last >= 0xd800 && last <= 0xdbff) end -= 1;
    out.push(text.slice(at, end));
    at = end;
  }
  return out.length > 0 ? out : [""];
}
