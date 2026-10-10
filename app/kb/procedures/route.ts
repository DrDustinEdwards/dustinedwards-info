// What the procedure page, its sheet and its twin share: the cache tag, the trail and the scale a
// request asks for.
import { LIBRARY_BASES, libraryTrail } from "../libraries.mjs";
import type { ProcedureRecord } from "./render.mjs";
import { scaleFactor } from "./render.mjs";

/** Every procedure response carries it; a save purges it (app/kb/procedures/save.server.ts). */
export const PROCEDURES_CACHE_TAG = "procedures";

/** The trail above a procedure: its hub, the list it sits in, then itself. */
export function procedureTrail(record: ProcedureRecord): Array<[string, string]> {
  if (record.profile === "protocol") {
    return [
      ["Research", "/research"],
      ["Protocols", "/research/protocols"],
      [record.title, record.path],
    ];
  }
  // A how-to sits under Software and a recipe on its own, each in its base's library (app/kb/libraries.mjs).
  const base = LIBRARY_BASES.find((b) => b.profile === record.profile);
  return [...(base ? libraryTrail(base) : []), [record.title, record.path]];
}

/**
 * The reader's scale from the URL: `?n=` tubes (or the protocol's unit), `?servings=` for a recipe.
 * Anything out of range falls back to the file's own count, so a bad link still shows the procedure.
 */
export function readScale(record: ProcedureRecord, url: URL) {
  const raw = record.profile === "recipe" ? url.searchParams.get("servings") : url.searchParams.get("n");
  const asked = raw === null ? null : Number(raw);
  const base = record.profile === "recipe" ? (record.servings ?? 1) : (record.scale?.count ?? 1);
  const valid = asked !== null && Number.isFinite(asked) && asked > 0 && asked <= 1000;
  const count = valid ? asked : base;
  // A protocol's steps stay per unit; only its material totals scale, by count. A recipe's steps scale.
  const factor = record.profile === "recipe" ? scaleFactor(record, count) : 1;
  return { count, factor };
}
