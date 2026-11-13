// The network of systems at /systems and each system at /systems/<id>: Capsid's public model
// (data/system-model.json, the document Capsid serves at /public/model/v1.json) checked, then shown
// by Capsomer's system map, the network as hexagons (the plain map of cards a tab away) and one system at level 2 (Dustin, 2026-11-03).
// Ruling: capsid/rulings/system-explorer-2026-10-10.md, answer 9 (the same component as the explorer).
//
// Every system is drawn whole, a private repo's included (Dustin, 2026-10-23: "do not exclude
// private repos", "fully wired just like the public ones"); a private system carries no repo
// link. The file is refused unless every key is one the published shape allows and a private
// system names no repo, so a mistake upstream stops the build rather than reaching the page.
import { modelMapData } from "capsomer/behavior/system-map";
// Zod builds its parsers, and probes `new Function`, when a schema is created, so the flag goes first (site-runtime ./zod-jitless).
import "@dustinedwards/site-runtime/zod-jitless";
// After the flag: Capsomer's model module builds its schema when it loads. The schema and its checks (ids unique,
// every line and flow on things that exist, the counts) are Capsomer's parsePublicModel, the producer's own rules.
import {
  connectionsOf,
  outsideOf,
  parsePublicModel,
  partsOf,
  SYSTEM_RINGS,
  wiresOf,
} from "capsomer/behavior/system-model";

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
 * The Capsid explorer, built from the same public model, so every system here has a page
 * there under the same id, private ones included (design section 4, "Deep links both ways").
 */
export const EXPLORER_ORIGIN = "https://capsid.dustinedwards.info";
/** @param {string} id */
export const explorerUrl = (id) => `${EXPLORER_ORIGIN}/s/${id}/`;

/**
 * What Capsomer's map shows, the same as the explorer's (Capsomer's modelMapData): every system, linking to its own
 * page here, every line and the parts.
 * @param {SystemModel} model
 */
export const mapData = (model) => modelMapData(model, systemPath);

// A system's connections, parts, what is outside it and the lines between them are Capsomer's
// (capsomer/behavior/system-model), the same reading the Capsid explorer gives.
/** @type {Record<ModelSystem["ring"], string>} */
const RING_HEADINGS = { core: "Runs everything", shared: "Shared parts", used: "What people use" };

/**
 * One container as the twin and the page write it: name, what it runs on, what it does.
 * @param {SystemModel["containers"][number]} c
 */
const containerLine = (c) =>
  `${c.name} (${c.technology})${c.description ? `: ${c.description}` : ""}`;

/**
 * What a system's page says about it: its sentence, and that its repo is private when it is.
 * @param {{ description?: string, private?: boolean }} s a system in the model or on the map
 */
const summaryOf = (s) =>
  [s.description, s.private ? "Its repo is private." : undefined].filter(Boolean).join(" ");

/**
 * The repo link a public system shows: its first repo, unless it has none.
 * @param {ModelSystem} s
 */
export const repoOf = (s) => (s.private ? undefined : s.repos?.[0]);

/**
 * The markdown twin of /systems: every system, grouped by ring, each with the facts the page shows
 * on its page, so an agent reads what a person does.
 * @param {SystemModel} model
 * @param {string} origin
 */
export function systemsMarkdown(model, origin) {
  const lines = [
    "# Systems",
    "",
    `The systems Dustin Edwards runs. Public model of ${model.as_of}.`,
    "",
  ];
  for (const ring of SYSTEM_RINGS) {
    const inRing = model.systems.filter((s) => s.ring === ring);
    if (inRing.length === 0) continue;
    lines.push(`## ${RING_HEADINGS[ring]}`, "");
    for (const s of inRing) lines.push(systemSectionMarkdown(model, s.id, origin) ?? "");
  }
  lines.push(`Capsid explorer: ${EXPLORER_ORIGIN}/`, "");
  return lines.join("\n");
}

/**
 * One system's section of /systems.md: what its page shows.
 * @param {SystemModel} model
 * @param {string} id
 * @param {string} origin
 */
export function systemSectionMarkdown(model, id, origin) {
  const s = model.systems.find((x) => x.id === id);
  if (!s) return null;
  const lines = [`### ${s.name}${s.private ? " (private)" : ""}`, ""];
  lines.push(summaryOf(s), "");
  lines.push(`- Its page: ${origin}${systemPath(s.id)}`);
  if (s.domain) lines.push(`- Address: https://${s.domain}`);
  const repo = repoOf(s);
  if (repo) lines.push(`- Source: ${repo}`);
  lines.push(`- In the Capsid explorer: ${explorerUrl(s.id)}`);
  const parts = partsOf(model, id);
  const outside = outsideOf(model, id);
  if (parts.length) lines.push("", "#### Inside", "", ...parts.map((c) => `- ${containerLine(c)}`));
  if (outside.length)
    lines.push("", "#### Outside it", "", ...outside.map((c) => `- ${containerLine(c)}`));
  const wires = wiresOf(model, id);
  if (wires.length) lines.push("", "How they connect:", "", ...wires.map((w) => `- ${w}`));
  const links = connectionsOf(model, id);
  lines.push("", "#### Connections", "");
  if (links.length === 0) lines.push("No connections.");
  for (const c of links) lines.push(`- ${c.verb} [${c.name}](${origin}${systemPath(c.other)})`);
  lines.push("");
  return lines.join("\n");
}
