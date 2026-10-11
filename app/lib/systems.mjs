// The family of systems at /systems: Capsid's public model (data/system-model.json, the
// document Capsid serves at /public/model/v1.json) checked, then drawn by Capsomer's system
// map. Ruling: capsid/rulings/system-explorer-2026-10-10.md; design:
// capsid/research/design-system-explorer.md, sections 2 and 3 (slice 4).
//
// Capsid filters the model before it publishes it. The check here is the design's third
// line: the file is refused unless every key is one the published shape allows, and a
// private system is refused if it carries anything past its name, short name, domain,
// family and ring. So a mistake upstream stops the build rather than reaching the page.
import { z } from "zod";

export const SYSTEMS_PATH = "/systems";

const Id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
/** @param {number} max */
const Text = (max) => z.string().min(1).max(max);
// The enums are capsid's (src/system-model.ts), so a value it publishes is never refused here.
const FAMILIES = /** @type {const} */ (["system", "writing", "product", "plumbing", "site"]);
const RINGS = /** @type {const} */ (["core", "shared", "used"]);
const RELATIONSHIP_KINDS = /** @type {const} */ (["installs", "publishes-to", "coordinates", "watches", "reads", "writes", "deploys", "serves"]);
const CONTAINER_KINDS = /** @type {const} */ (["worker", "database", "bucket", "kv", "queue", "cron", "package", "site", "external"]);

const OpenSystem = z.strictObject({
  id: Id,
  name: Text(40),
  short: Text(12),
  family: z.enum(FAMILIES),
  ring: z.enum(RINGS),
  private: z.literal(false),
  description: Text(280).optional(),
  domain: Text(253).optional(),
  repos: z.array(z.url().max(512)).optional(),
});

/** Ruling 3: a private system is a public name and a domain, placed on the map. */
export const PRIVATE_SYSTEM_KEYS = ["id", "name", "short", "domain", "family", "ring", "private"];
const PrivateSystem = z.strictObject({
  id: Id,
  name: Text(40),
  short: Text(12),
  // Empty when the model calls a system public and GitHub does not: Capsid reduces it to
  // private with no address (src/system-model.ts, toPublic), and the page shows none.
  domain: z.string().max(253),
  family: z.enum(FAMILIES),
  ring: z.enum(RINGS),
  private: z.literal(true),
});

const PublicModel = z.strictObject({
  version: z.literal(1),
  as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Private first: a node marked private is judged by the narrow shape, never the open one.
  systems: z.array(z.union([PrivateSystem, OpenSystem])),
  containers: z.array(
    z.strictObject({
      id: Id,
      system: Id,
      name: Text(40),
      kind: z.enum(CONTAINER_KINDS),
      technology: Text(60),
      description: Text(280).optional(),
    })
  ),
  relationships: z.array(
    z.strictObject({
      id: Text(200),
      from: Id,
      to: Id,
      kind: z.enum(RELATIONSHIP_KINDS),
      title: Text(280).optional(),
    })
  ),
  counts: z.strictObject({
    systems: z.number().int(),
    public: z.number().int(),
    private: z.number().int(),
    containers: z.number().int(),
    relationships: z.number().int(),
  }),
});

/** @typedef {z.infer<typeof PublicModel>} SystemModel */
/** @typedef {SystemModel["systems"][number]} ModelSystem */

/**
 * The model, or the reasons it is refused. Beyond the shape: ids are unique, every
 * relationship and container names something that exists, no container belongs to a private
 * system, and no relationship touching a private system carries a title or reaches inside it.
 * @param {unknown} raw
 * @returns {{ ok: true, model: SystemModel } | { ok: false, problems: string[] }}
 */
export function parseSystemModel(raw) {
  const parsed = PublicModel.safeParse(raw);
  if (!parsed.success) return { ok: false, problems: parsed.error.issues.map((i) => `${i.path.join(".") || "(model)"}: ${i.message}`) };
  const model = parsed.data;
  const problems = [];
  const systems = new Map(model.systems.map((s) => [s.id, s]));
  const containers = new Map(model.containers.map((c) => [c.id, c]));
  if (systems.size !== model.systems.length) problems.push("systems: an id is used twice");
  if (containers.size !== model.containers.length) problems.push("containers: an id is used twice");
  for (const c of model.containers) {
    const owner = systems.get(c.system);
    if (!owner) problems.push(`containers.${c.id}: no system ${c.system}`);
    else if (owner.private) problems.push(`containers.${c.id}: inside private system ${c.system}`);
  }
  for (const r of model.relationships) {
    for (const end of [r.from, r.to]) {
      if (!systems.has(end) && !containers.has(end)) problems.push(`relationships.${r.id}: no element ${end}`);
    }
    const touchesPrivate = [r.from, r.to].some((end) => systems.get(end)?.private);
    if (touchesPrivate && r.title !== undefined) problems.push(`relationships.${r.id}: a title on a line to a private system`);
    if (touchesPrivate && [r.from, r.to].some((end) => containers.has(end))) problems.push(`relationships.${r.id}: reaches inside a system to a private one`);
  }
  const counts = model.counts;
  const privates = model.systems.filter((s) => s.private).length;
  if (
    counts.systems !== model.systems.length ||
    counts.private !== privates ||
    counts.public !== model.systems.length - privates ||
    counts.containers !== model.containers.length ||
    counts.relationships !== model.relationships.length
  ) {
    problems.push("counts: do not match the systems");
  }
  return problems.length ? { ok: false, problems } : { ok: true, model };
}

/**
 * The checked model, or a thrown error naming every problem: a bad file stops the build.
 * @param {unknown} raw
 */
export function loadSystemModel(raw) {
  const result = parseSystemModel(raw);
  if (!result.ok) throw new Error(`data/system-model.json is refused:\n  ${result.problems.join("\n  ")}`);
  return result.model;
}

/** @param {string} id */
export const systemPath = (id) => `${SYSTEMS_PATH}/${id}`;

// The word under a capsomer's name. A private system shows "private" (Capsomer adds it).
/** @type {Record<ModelSystem["family"], string>} */
const FAMILY_WORD = { system: "system", writing: "writing", product: "product", plumbing: "plumbing", site: "site" };
/** @param {ModelSystem} s */
const tagOf = (s) => (s.ring === "core" ? undefined : s.ring === "shared" ? "shared" : FAMILY_WORD[s.family]);

/**
 * What Capsomer's map draws: every system with its page as its link, every line (the map
 * draws those between systems, the inside view those between the core's containers), and
 * the containers.
 * @param {SystemModel} model
 */
export function mapData(model) {
  return {
    systems: model.systems.map((s) => ({
      id: s.id,
      name: s.name,
      short: s.short,
      ring: s.ring,
      private: s.private,
      tag: tagOf(s),
      // A private system has none: parseSystemModel refuses it.
      description: s.private ? undefined : s.description,
      domain: s.domain || undefined,
      href: systemPath(s.id),
    })),
    relationships: model.relationships.map(({ from, to, kind }) => ({ from, to, kind })),
    // The box under each part names its kind (worker, database): Capsomer's boxes are sized for a word, and the
    // longer technology line is in the page's list of parts and the twin.
    containers: model.containers.map(({ id, system, name, kind }) => ({ id, system, name, kind })),
  };
}

// How a line reads from each end.
/** @type {Record<SystemModel["relationships"][number]["kind"], [string, string]>} */
const VERB = {
  installs: ["installs", "is installed by"],
  "publishes-to": ["publishes to", "is published to by"],
  coordinates: ["coordinates", "is coordinated by"],
  watches: ["watches", "is watched by"],
  reads: ["reads", "is read by"],
  writes: ["writes to", "is written to by"],
  deploys: ["deploys", "is deployed by"],
  serves: ["serves", "is served by"],
};

/**
 * One system's connections to other systems, in the model's order: the verb as read from this
 * end, and the system at the other.
 * @param {SystemModel} model
 * @param {string} id
 * @returns {Array<{ verb: string, other: string, name: string }>}
 */
export function connectionsOf(model, id) {
  const byId = new Map(model.systems.map((s) => [s.id, s]));
  return model.relationships
    .filter((r) => (r.from === id || r.to === id) && byId.has(r.from) && byId.has(r.to) && r.from !== r.to)
    .map((r) => {
      const out = r.from === id;
      const other = /** @type {ModelSystem} */ (byId.get(out ? r.to : r.from));
      const verb = VERB[r.kind][out ? 0 : 1];
      return { verb: `${verb.charAt(0).toUpperCase()}${verb.slice(1)}`, other: other.id, name: other.name };
    });
}

/** @type {Record<ModelSystem["ring"], string>} */
const RING_HEADINGS = { core: "Runs everything", shared: "Shared parts", used: "What people use" };

/**
 * A system's parts, in the model's order.
 * @param {SystemModel} model
 * @param {string} id
 */
export const partsOf = (model, id) => model.containers.filter((c) => c.system === id);

/**
 * The lines between a system's parts, as sentences ("MCP Worker writes to capsid"), in the model's order.
 * @param {SystemModel} model
 * @param {string} id
 */
export function wiresOf(model, id) {
  const parts = new Map(partsOf(model, id).map((c) => [c.id, c]));
  return model.relationships
    .filter((r) => parts.has(r.from) && parts.has(r.to))
    .map((r) => `${parts.get(r.from)?.name} ${VERB[r.kind][0]} ${parts.get(r.to)?.name}`);
}

/**
 * What a system's page says in place of a description: a private system is its name, and its
 * address when Capsid has one for it.
 * @param {ModelSystem} s
 */
export const summaryOf = (s) => (s.private ? (s.domain ? "Private: its name and address only." : "Private: its name only.") : (s.description ?? ""));

/**
 * The repo link a public system shows: its first repo, unless it has none.
 * @param {ModelSystem} s
 */
export const repoOf = (s) => (s.private ? undefined : s.repos?.[0]);

/**
 * The markdown twin of /systems: the same systems, grouped by ring, with their connections.
 * @param {SystemModel} model
 * @param {string} origin
 */
export function systemsMarkdown(model, origin) {
  const lines = [
    "# Systems",
    "",
    `The family of systems Dustin Edwards runs, drawn as a capsid: Capsid in the middle, the shared parts around it, what people use on the outside. From Capsid's public model of ${model.as_of}.`,
    "",
  ];
  for (const ring of RINGS) {
    const inRing = model.systems.filter((s) => s.ring === ring);
    if (inRing.length === 0) continue;
    lines.push(`## ${RING_HEADINGS[ring]}`, "");
    for (const s of inRing) lines.push(`- [${s.name}](${origin}${systemPath(s.id)}.md)${s.private ? " (private)" : ""}${s.private || !s.description ? "" : `: ${s.description}`}`);
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * The markdown twin of /systems/<id>.
 * @param {SystemModel} model
 * @param {string} id
 * @param {string} origin
 */
export function systemMarkdown(model, id, origin) {
  const s = model.systems.find((x) => x.id === id);
  if (!s) return null;
  const lines = [`# ${s.name}`, ""];
  lines.push(summaryOf(s), "");
  lines.push(`- Ring: ${RING_HEADINGS[s.ring]}`);
  if (s.domain) lines.push(`- Address: https://${s.domain}`);
  const repo = repoOf(s);
  if (repo) lines.push(`- Source: ${repo}`);
  const parts = partsOf(model, id);
  if (parts.length) {
    lines.push("", "## Inside", "");
    for (const c of parts) lines.push(`- ${c.name} (${c.technology})${c.description ? `: ${c.description}` : ""}`);
    const wires = wiresOf(model, id);
    if (wires.length) lines.push("", "How they connect:", "", ...wires.map((w) => `- ${w}`));
  }
  const links = connectionsOf(model, id);
  lines.push("", "## Connections", "");
  if (links.length === 0) lines.push("None drawn.");
  for (const c of links) lines.push(`- ${c.verb} [${c.name}](${origin}${systemPath(c.other)}.md)`);
  lines.push("", `All systems: ${origin}${SYSTEMS_PATH}.md`, "");
  return lines.join("\n");
}
