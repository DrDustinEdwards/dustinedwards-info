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
 *   registry?: { primers: (ids: string[]) => Promise<Map<string, import("./render.mjs").StoredPrimer>> },
 * }} input
 * @returns {Promise<
 *   | { ok: false, errors: string[], gaps: Array<{ field: string, reason: string }> }
 *   | { ok: true, errors: [], gaps: Array<{ field: string, reason: string }>, record: import("./render.mjs").ProcedureRecord,
 *       markdown: string, searchInput: ReturnType<typeof procedureSearchInput>, sourcePath: string, sourceBlobSha: string }
 * >}
 */
export async function compileProcedure({ slug, raw, pipeline, resolveImage, registry }) {
  if (!PROCEDURE_SLUG.test(slug)) {
    return { ok: false, errors: [`"${slug}" is not a lowercase kebab-case slug`], gaps: [] };
  }
  const file = procedurePath(slug);
  const dashes = pipeline.findWideDashes(raw).map(
    (hit) => `line ${hit.line}, column ${hit.column}: wide dash ${hit.char}; house style uses commas, periods, parentheses or colons ("${hit.excerpt}")`,
  );
  const parsed = parseProcedure({ file, raw });
  // A protocol names its primers by their id in the lab registry and stores no sequence (docs/REGISTRY.md); the registry's
  // rows are read here, so the record carries them and a frozen version freezes them. A caller with no registry cannot
  // compile a protocol that names primers: writing a record with no primer table would be silent.
  const named = Array.isArray(parsed.data.primers) ? parsed.data.primers.flatMap((p) => (typeof p?.primer === "string" ? [p.primer] : [])) : [];
  if (named.length > 0 && !registry) {
    return { ok: false, errors: ["this compile was given no lab registry, so the primers the file names cannot be read"], gaps: [] };
  }
  const primerRows = named.length > 0 && registry ? await registry.primers(named) : new Map();
  const { errors, gaps } = validateProcedure(parsed, { slug, primers: new Set(primerRows.keys()) });
  // A draft primer is the admin's alone, so a published protocol may not print it.
  if (parsed.data.draft !== true) {
    for (const [id, row] of primerRows) if (row.status === "draft") errors.push(`primers[${id}] is a draft in the lab registry, so a published protocol cannot print it`);
  }
  errors.unshift(...dashes);
  if (errors.length > 0) return { ok: false, errors, gaps };

  let record;
  try {
    record = await renderProcedure({
      slug,
      parsed,
      gaps,
      renderBody: pipeline.renderBody,
      resolveImage,
      primerRows: named.flatMap((id) => (primerRows.has(id) ? [primerRows.get(id)] : [])),
    });
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
