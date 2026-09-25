/**
 * Source regions bounded by the code's own braces, for gates that assert on source text. A fixed
 * character window after a marker gives a false failure when a reformat pushes the needle out of it,
 * and a false pass when it runs on into the next function; a brace-bounded region does neither.
 * Not a parser: string literals are skipped whole, but a brace inside a regex literal or a comment
 * still counts, so strip comments first.
 */

/**
 * The block that opens at the first `{` at or after `from`, braces included, or "" when there is
 * none or it is never closed.
 *
 * @param {string} src
 * @param {number} from
 * @returns {string}
 */
export function blockFrom(src, from) {
  const open = src.indexOf("{", from);
  if (open === -1) return "";
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      i += 1;
      while (i < src.length && src[i] !== c) i += src[i] === "\\" ? 2 : 1;
      continue;
    }
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return "";
}

/**
 * The body of the first function whose declaration matches `declaration`, braces included, or "".
 * The body is the first block after the first `)` that follows the declaration, so a parameter
 * list with nested parentheses (a default that calls something) is not supported.
 *
 * @param {string} src
 * @param {RegExp} declaration
 * @returns {string}
 */
export function functionBody(src, declaration) {
  const at = src.search(declaration);
  if (at === -1) return "";
  const close = src.indexOf(")", at);
  if (close === -1) return "";
  return blockFrom(src, close);
}
