// One door from a procedure file to everything derived from it: parse, validate, render, the markdown
// twin and the search input. check:protocols, sync:content and the operator API's save_procedure all
// call compileProcedure, so a file CI passes is the file the save tool accepts and the page draws.

import { gitBlobSha } from "../content/hashes.mjs";
import { parseProcedure, procedurePath } from "./parse.mjs";
import { procedureSearchInput, renderProcedure } from "./render.mjs";
import { validateProcedure } from "./validate.mjs";

/** The file name a slug is written in; the same rule as a post's. */
export const PROCEDURE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * @param {{
 *   slug: string,
 *   raw: string,
 *   pipeline: { renderBody: import("./render.mjs").RenderBody, findWideDashes: (text: string) => Array<{ line: number, column: number, char: string, excerpt: string }> },
 *   resolveImage?: (src: string) => Promise<{ width: number, height: number }>,
 * }} input
 * @returns {Promise<
 *   | { ok: false, errors: string[], gaps: Array<{ field: string, reason: string }> }
 *   | { ok: true, errors: [], gaps: Array<{ field: string, reason: string }>, record: import("./render.mjs").ProcedureRecord,
 *       markdown: string, searchInput: ReturnType<typeof procedureSearchInput>, sourcePath: string, sourceBlobSha: string }
 * >}
 */
export async function compileProcedure({ slug, raw, pipeline, resolveImage }) {
  if (!PROCEDURE_SLUG.test(slug)) {
    return { ok: false, errors: [`"${slug}" is not a lowercase kebab-case slug`], gaps: [] };
  }
  const file = procedurePath(slug);
  const dashes = pipeline.findWideDashes(raw).map(
    (hit) => `line ${hit.line}, column ${hit.column}: wide dash ${hit.char}; house style uses commas, periods, parentheses or colons ("${hit.excerpt}")`,
  );
  const parsed = parseProcedure({ file, raw });
  const { errors, gaps } = validateProcedure(parsed, { slug });
  errors.unshift(...dashes);
  if (errors.length > 0) return { ok: false, errors, gaps };

  let record;
  try {
    record = await renderProcedure({ slug, parsed, gaps, renderBody: pipeline.renderBody, resolveImage });
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : String(error)], gaps };
  }
  const searchInput = procedureSearchInput(record, parsed);
  return {
    ok: true,
    errors: [],
    gaps,
    record,
    markdown: searchInput.markdown,
    searchInput,
    sourcePath: file,
    sourceBlobSha: await gitBlobSha(raw),
  };
}
