// One door from a procedure file to everything derived from it: parse, validate, render, the markdown
// twin and the search input. check:protocols, sync:content and the operator API's save_procedure all
// call compileProcedure, so a file CI passes is the file the save tool accepts and the page draws.

import { gitBlobSha } from "../content/hashes.mjs";
import { itemPath } from "../registry/catalog.mjs";
import { NON_STRAIN_ORGANISMS } from "./taxonomy.mjs";
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
 *   registry?: {
 *     primers: (ids: string[]) => Promise<Map<string, import("./render.mjs").StoredPrimer>>,
 *     strains: (ids: string[]) => Promise<Map<string, import("./render.mjs").StoredStrain>>,
 *   },
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
  const namedStrains = Array.isArray(parsed.data.host_strain) ? parsed.data.host_strain.flatMap((s) => (typeof s?.strain === "string" ? [s.strain] : [])) : [];
  // An organism that is not a non-strain organism is a strain of the registry, so it is read from there too.
  const organismIds = Array.isArray(parsed.data.organism) ? parsed.data.organism.filter((id) => typeof id === "string" && !Object.hasOwn(NON_STRAIN_ORGANISMS, id)) : [];
  if ((named.length > 0 || namedStrains.length > 0 || organismIds.length > 0) && !registry) {
    return { ok: false, errors: ["this compile was given no lab registry, so the primers, host strains and organisms the file names cannot be read"], gaps: [] };
  }
  const primerRows = named.length > 0 && registry ? await registry.primers(named) : new Map();
  const strainIds = [...new Set([...namedStrains, ...organismIds])];
  const strainRows = strainIds.length > 0 && registry ? await registry.strains(strainIds) : new Map();
  const { errors, gaps } = validateProcedure(parsed, { slug, primers: new Set(primerRows.keys()), strains: new Set(strainRows.keys()) });
  // A draft primer is the admin's alone, so a published protocol may not print it.
  if (parsed.data.draft !== true) {
    for (const [id, row] of primerRows) if (row.status === "draft") errors.push(`primers[${id}] is a draft in the lab registry, so a published protocol cannot print it`);
    for (const [id, row] of strainRows) if (row.status === "draft") errors.push(`strain ${id} is a draft in the lab registry, so a published protocol cannot name it`);
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
      // The strain's page is where the protocol links it, computed from its id here and not typed anywhere.
      strainRows: namedStrains.flatMap((id) => (strainRows.has(id) ? [{ ...strainRows.get(id), path: itemPath("strain", id) }] : [])),
      // The words for each organism id the protocol names, from the registry (or the non-strain list), so the library needs no list of its own.
      organismNames: Object.fromEntries(
        (Array.isArray(parsed.data.organism) ? parsed.data.organism : []).flatMap((id) => {
          const words = Object.hasOwn(NON_STRAIN_ORGANISMS, id) ? /** @type {Record<string, string>} */ (NON_STRAIN_ORGANISMS)[id] : strainRows.get(id)?.organism;
          return words ? [[id, words]] : [];
        }),
      ),
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
