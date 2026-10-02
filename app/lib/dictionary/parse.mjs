// Reads a dictionary entry file (docs/DICTIONARY.md) into its front matter as written and its body, the
// editors' notes. Nothing here judges: compile.mjs does, so the gate, the build and the save read one parse.

import matter from "gray-matter";

export const DICTIONARY_DIR = "content/dictionary";

/** The repository path of an entry's file, from its key (`capsid`). */
export function dictionaryPath(/** @type {string} */ key) {
  return `${DICTIONARY_DIR}/${key}.md`;
}

/**
 * @typedef {{ data: Record<string, unknown>, body: string, problems: string[] }} ParsedEntry
 */

/**
 * @param {{ file: string, raw: string }} input
 * @returns {ParsedEntry}
 */
export function parseDictionaryEntry({ file, raw }) {
  /** @type {string[]} */
  const problems = [];
  if (!raw.startsWith("---")) {
    problems.push(`${file}: the file must start with a --- front matter block`);
  }
  try {
    // An options object, even an empty one: gray-matter caches by input when it is omitted, and a cached
    // parse is one object shared by every caller.
    const parsed = matter(raw, {});
    return { data: /** @type {Record<string, unknown>} */ (parsed.data), body: parsed.content, problems };
  } catch (error) {
    problems.push(`${file}: the front matter does not parse: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    return { data: {}, body: "", problems };
  }
}
