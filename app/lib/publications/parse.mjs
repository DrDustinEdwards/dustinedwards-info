// Reads a publication file (docs/PUBLICATIONS.md) into the front matter as written and the one body
// section it may carry, the extracted full text. Nothing here judges: validate.mjs does, so the check and
// the save tool read one parse.

import matter from "gray-matter";

import { yamlPlain } from "../yaml-plain.mjs";

export const PUBLICATIONS_DIR = "content/publications";

/** The repository path of a publication's file. */
export function publicationPath(/** @type {string} */ slug) {
  return `${PUBLICATIONS_DIR}/${slug}.md`;
}

/** The only heading the body may carry. Everything after it is the PDF's extracted text. */
export const FULL_TEXT_HEADING = "## Full text";

const FULL_TEXT_LINE = /^## Full text[ \t]*$/m;

/**
 * @typedef {{ data: Record<string, unknown>, fullText: string | null, problems: string[] }} ParsedPublication
 */

/**
 * @param {{ file: string, raw: string }} input
 * @returns {ParsedPublication} `fullText` is null when the file has no Full text section, and a string (possibly empty) when it has.
 */
export function parsePublication({ file, raw }) {
  /** @type {string[]} */
  const problems = [];
  /** @type {Record<string, unknown>} */
  let data = {};
  let content = "";
  try {
    // An options object, even an empty one: gray-matter caches by input when it is omitted, and a
    // cached parse is one object shared by every caller.
    const parsed = matter(raw, {});
    data = /** @type {Record<string, unknown>} */ (yamlPlain(parsed.data));
    content = parsed.content;
  } catch (error) {
    problems.push(`${file}: the front matter does not parse: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    return { data, fullText: null, problems };
  }
  if (!raw.startsWith("---")) {
    problems.push(`${file}: the file must start with a --- front matter block`);
  }

  const heading = FULL_TEXT_LINE.exec(content);
  if (!heading) {
    if (content.trim() !== "") {
      problems.push(
        `${file}: the body carries text outside a "${FULL_TEXT_HEADING}" section. The abstract belongs in front matter, and the body holds only the PDF's extracted text under that heading.`,
      );
    }
    return { data, fullText: null, problems };
  }
  const before = content.slice(0, heading.index).trim();
  if (before !== "") {
    problems.push(
      `${file}: the body carries text before the "${FULL_TEXT_HEADING}" heading. The abstract belongs in front matter, and the body holds only the PDF's extracted text.`,
    );
  }
  const fullText = content.slice(heading.index + heading[0].length).trim();
  return { data, fullText, problems };
}
