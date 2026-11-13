// The network of systems at /systems and each system at /systems/<id>: Capsid's public model
// (data/system-model.json, the document Capsid serves at /public/model/v1.json) checked, then shown
// by Capsomer's system map, the network as hexagons (the plain map of cards a tab away) and one system at level 2 (Dustin, 2026-11-03).
// Ruling: capsid/rulings/system-explorer-2026-10-10.md, answer 9 (the same component as the explorer).
//
// Every system is drawn whole, a private repo's included (Dustin, 2026-10-23: "do not exclude
// private repos", "fully wired just like the public ones"); a private system carries no repo
// link. The file is refused unless every key is one the published shape allows and a private
// system names no repo, so a mistake upstream stops the build rather than reaching the page.
// Zod builds its parsers, and probes `new Function`, when a schema is created, so the flag goes first (site-runtime ./zod-jitless).
import "@dustinedwards/site-runtime/zod-jitless";
// The shape and its cross-checks are Capsomer's, the one schema every reader of Capsid's model uses.
import { parsePublicModel } from "capsomer/behavior/system-model";
import { modelMapData } from "capsomer/behavior/system-map";

export const SYSTEMS_PATH = "/systems";

/** @typedef {import("capsomer/behavior/system-model").PublicModel} SystemModel */
/** @typedef {SystemModel["systems"][number]} ModelSystem */

/**
 * The checked model, or a thrown error naming every problem: a bad file stops the build.
 * @param {unknown} raw
 */
export function loadSystemModel(raw) {
  const result = parsePublicModel(raw);
  if (!result.ok)
    throw new Error(`data/system-model.json is refused:\n  ${result.problems.join("\n  ")}`);
  return result.model;
}

/** The page of one system: Capsomer's system map at level 2. @param {string} id */
export const systemPath = (id) => `${SYSTEMS_PATH}/${encodeURIComponent(id)}`;

/**
 * What Capsomer's map shows, the same as the explorer's (Capsomer's modelMapData): every system, linking to its own
 * page here, every line and the parts.
 * @param {SystemModel} model
 */
export const mapData = (model) => modelMapData(model, systemPath);

/**
 * The repo link a public system shows: its first repo, unless it has none.
 * @param {ModelSystem} s
 */
export const repoOf = (s) => (s.private ? undefined : s.repos?.[0]);
