// The checks every front-matter kind (phages, roster, registry, pages, the CV, procedures, dictionary entries)
// opens with, worded once so a writer reads the same error whatever kind they saved. Light on purpose: the
// compiles import it, and the Worker loads the markdown pipeline (and its findWideDashes) lazily.

import { matter } from "@drdustinedwards/site-helpers/matter";

/**
 * The house-style error for one wide dash the pipeline's findWideDashes found.
 *
 * @param {{ line: number, column: number, char: string, excerpt: string }} hit
 */
export const wideDashError = (hit) =>
  `line ${hit.line}, column ${hit.column}: wide dash ${hit.char}; house style uses commas, periods, parentheses or colons ("${hit.excerpt}")`;

/**
 * A file that is its front matter: parsed, or null when its YAML does not parse. A file that does not start
 * with a --- block still parses, so the writer sees every error at once; each error is pushed onto `errors`.
 *
 * @param {string} raw
 * @param {string[]} errors
 */
export function parseFrontMatter(raw, errors) {
  if (!raw.startsWith("---")) errors.push("the file must start with a --- front matter block");
  try {
    return matter(raw);
  } catch (error) {
    errors.push(
      `the front matter is not valid YAML: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`,
    );
    return null;
  }
}
