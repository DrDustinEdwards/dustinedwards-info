// The family of systems at /systems: Capsid's public model (data/system-model.json, the
// document Capsid serves at /public/model/v1.json) checked, then drawn by Capsomer's system
// map. Ruling: capsid/rulings/system-explorer-2026-10-10.md; design:
// capsid/research/design-system-explorer.md, sections 2 and 3 (slice 4).
//
// Every system is drawn whole, a private repo's included (Dustin, 2026-10-23: "do not exclude
// private repos", "fully wired just like the public ones"); a private system carries no repo
// link. The file is refused unless every key is one the published shape allows and a private
// system names no repo, so a mistake upstream stops the build rather than reaching the page.
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

// A private system is everything a public one is but its repo link (capsid src/system-model.ts).
const PrivateSystem = OpenSystem.omit({ repos: true }).extend({ private: z.literal(true) });

const PublicModel = z.strictObject({
  version: z.literal(1),
  as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
  // Capsid's flows (design section 4): walks the explorer animates. Optional, as Capsid's own
  // schema has it, so a model written before flows existed still parses. Not drawn here.
  flows: z
    .array(
      z.strictObject({
        id: Id,
        name: Text(60),
        description: Text(280).optional(),
        steps: z
          .array(
            z.strictObject({
              relationship: Text(200),
              toward: Id,
              text: Text(280),
              lights: z.array(Id).max(8).optional(),
            })
          )
          .min(2)
          .max(20),
      })
    )
    .optional(),
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
 * relationship and container names something that exists, and every flow rides lines the
 * model has.
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
    if (!systems.has(c.system)) problems.push(`containers.${c.id}: no system ${c.system}`);
  }
  for (const r of model.relationships) {
    for (const end of [r.from, r.to]) {
      if (!systems.has(end) && !containers.has(end)) problems.push(`relationships.${r.id}: no element ${end}`);
    }
  }
  const edges = new Map(model.relationships.map((r) => [r.id, r]));
  const flowIds = new Set();
  for (const f of model.flows ?? []) {
    if (flowIds.has(f.id)) problems.push(`flows.${f.id}: the id is used twice`);
    flowIds.add(f.id);
    f.steps.forEach((step, i) => {
      const where = `flows.${f.id}.steps.${i + 1}`;
      const edge = edges.get(step.relationship);
      if (!edge) {
        problems.push(`${where}: rides ${step.relationship}, which is not a relationship in the model`);
        return;
      }
      if (step.toward !== edge.from && step.toward !== edge.to) problems.push(`${where}: goes toward ${step.toward}, which is not an end of ${edge.id}`);
      // A light is a part the step touches, in a system one of its ends belongs to (Capsid's rule).
      const within = new Set([edge.from, edge.to].map((end) => containers.get(end)?.system ?? end));
      for (const l of step.lights ?? []) {
        const part = containers.get(l);
        if (!part) problems.push(`${where}: lights ${l}, which is not a container`);
        else if (!within.has(part.system)) problems.push(`${where}: lights ${l}, a part of ${part.system}, which the step does not run in`);
      }
    });
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

/**
 * The query parameter that names the chosen system on /systems. There is one page: a system is a
 * state of it, kept in the address so a shared link opens with that system chosen.
 */
export const SYSTEM_PARAM = "system";

/** The address of /systems with one system chosen. @param {string} id */
export const systemHref = (id) => `${SYSTEMS_PATH}?${SYSTEM_PARAM}=${encodeURIComponent(id)}`;

/**
 * The system a query value names, or null when it names none: an unknown value is the page with
 * nothing chosen, never an error.
 * @param {SystemModel} model
 * @param {string | null | undefined} value
 */
export const chosenSystem = (model, value) => (value && model.systems.some((s) => s.id === value) ? value : null);

/**
 * Capsomer's map with one system already chosen, as its controller leaves it: the root marked
 * selected, the system pressed, its lines on and the systems at their far ends linked. So the
 * server draws that system's wiring before any script runs, and with no script at all. Attributes
 * only: the drawing is Capsomer's and is not changed.
 * @param {string} html what systemMapHtml returned
 * @param {string} id a system on the map
 */
export function chooseInMapHtml(html, id) {
  /** @type {Set<string>} */
  const linked = new Set();
  let out = html.replace(/<path class="cap-system-map-edge" data-from="([^"]*)" data-to="([^"]*)"/g, (whole, from, to) => {
    if (from !== id && to !== id) return whole;
    linked.add(from === id ? to : from);
    return `${whole} data-on`;
  });
  out = out.replace(/<g class="cap-system-map-tile" data-id="([^"]*)"/g, (whole, tile) =>
    tile === id ? `${whole} aria-pressed="true"` : linked.has(tile) ? `${whole} data-linked` : whole,
  );
  return out.replace(/<figure class="cap-system-map" data-cap="system-map"/, (whole) => `${whole} data-selected`);
}

/**
 * The Capsid explorer, built from the same public model, so every system here has a page
 * there under the same id, private ones included (design section 4, "Deep links both ways").
 */
export const EXPLORER_ORIGIN = "https://capsid.dustinedwards.info";
/** @param {string} id */
export const explorerUrl = (id) => `${EXPLORER_ORIGIN}/s/${id}/`;
/** How a page shows that address, as it shows the others: host and path. @param {string} id */
export const explorerLabel = (id) => `${new URL(EXPLORER_ORIGIN).host}/s/${id}`;

// The word under a capsomer's name. A private system shows "private" (Capsomer adds it).
/** @type {Record<ModelSystem["family"], string>} */
// The word under a system and the group it is drawn in, in a stranger's words (Dustin, 2026-10-23:
// like goes with like, and the map should explain itself). An admin MCP sits in its app's group
// and says so.
const FAMILY_WORD = { system: "tool", writing: "writing", product: "app", plumbing: "tool", site: "site" };
const FAMILY_GROUP = { system: "Tools", writing: "Writing", product: "Apps", plumbing: "Tools", site: "Websites" };
/** @param {ModelSystem} s */
const tagOf = (s) => (s.ring === "core" ? undefined : s.ring === "shared" ? "shared" : s.id.endsWith("-mcp") ? "admin" : FAMILY_WORD[s.family]);

/**
 * What Capsomer's map draws: every system, with no link of its own, since choosing one shows its
 * facts on the same page (app/enhance/system-map.ts), every line (the map
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
      group: s.ring === "used" ? FAMILY_GROUP[s.family] : undefined,
      description: s.description,
      domain: s.domain || undefined,
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
export const partsOf = (model, id) => model.containers.filter((c) => c.system === id && c.kind !== "external");
/**
 * What a system works with outside its boundary: its `external` containers, such as Capsid's
 * Agents and GitHub (Dustin, 2026-10-11), never counted among its own parts.
 * @param {SystemModel} model
 * @param {string} id
 */
export const outsideOf = (model, id) => model.containers.filter((c) => c.system === id && c.kind === "external");

/**
 * The lines touching a system's parts, to each other or to what is outside it, as sentences
 * ("MCP Worker writes to capsid"), in the model's order.
 * @param {SystemModel} model
 * @param {string} id
 */
export function wiresOf(model, id) {
  // A line to what is outside the system counts too (the Worker serves the Agents); a line
  // between two outside things does not, since it touches none of the system's parts.
  const own = new Set(partsOf(model, id).map((c) => c.id));
  const parts = new Map(model.containers.filter((c) => c.system === id).map((c) => [c.id, c]));
  return model.relationships
    .filter((r) => parts.has(r.from) && parts.has(r.to) && (own.has(r.from) || own.has(r.to)))
    .map((r) => `${parts.get(r.from)?.name} ${VERB[r.kind][0]} ${parts.get(r.to)?.name}`);
}

/**
 * One container as the twin and the page write it: name, what it runs on, what it does.
 * @param {SystemModel["containers"][number]} c
 */
const containerLine = (c) => `${c.name} (${c.technology})${c.description ? `: ${c.description}` : ""}`;

/**
 * What a system's page says about it: its sentence, and that its repo is private when it is.
 * @param {ModelSystem} s
 */
export const summaryOf = (s) => [s.description, s.private ? "Its repo is private." : undefined].filter(Boolean).join(" ");

/**
 * The repo link a public system shows: its first repo, unless it has none.
 * @param {ModelSystem} s
 */
export const repoOf = (s) => (s.private ? undefined : s.repos?.[0]);

/**
 * The markdown twin of /systems: every system, grouped by ring, each with the facts the page shows
 * when it is chosen, so an agent reads what a person does.
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
  for (const ring of RINGS) {
    const inRing = model.systems.filter((s) => s.ring === ring);
    if (inRing.length === 0) continue;
    lines.push(`## ${RING_HEADINGS[ring]}`, "");
    for (const s of inRing) lines.push(systemSectionMarkdown(model, s.id, origin) ?? "");
  }
  lines.push(`Capsid explorer: ${EXPLORER_ORIGIN}/`, "");
  return lines.join("\n");
}

/**
 * One system's section of /systems.md: what the page shows when that system is chosen.
 * @param {SystemModel} model
 * @param {string} id
 * @param {string} origin
 */
export function systemSectionMarkdown(model, id, origin) {
  const s = model.systems.find((x) => x.id === id);
  if (!s) return null;
  const lines = [`### ${s.name}${s.private ? " (private)" : ""}`, ""];
  lines.push(summaryOf(s), "");
  lines.push(`- On the map: ${origin}${systemHref(s.id)}`);
  if (s.domain) lines.push(`- Address: https://${s.domain}`);
  const repo = repoOf(s);
  if (repo) lines.push(`- Source: ${repo}`);
  lines.push(`- In the Capsid explorer: ${explorerUrl(s.id)}`);
  const parts = partsOf(model, id);
  const outside = outsideOf(model, id);
  if (parts.length) lines.push("", "#### Inside", "", ...parts.map((c) => `- ${containerLine(c)}`));
  if (outside.length) lines.push("", "#### Outside it", "", ...outside.map((c) => `- ${containerLine(c)}`));
  const wires = wiresOf(model, id);
  if (wires.length) lines.push("", "How they connect:", "", ...wires.map((w) => `- ${w}`));
  const links = connectionsOf(model, id);
  lines.push("", "#### Connections", "");
  if (links.length === 0) lines.push("No connections.");
  for (const c of links) lines.push(`- ${c.verb} [${c.name}](${origin}${systemHref(c.other)})`);
  lines.push("");
  return lines.join("\n");
}

/**
 * Whether two models say the same thing. The date is left out: Capsid stamps its build every
 * day, and a pull request a day that changes only the date would teach a reviewer to skip them.
 * @param {SystemModel} a
 * @param {SystemModel} b
 */
export function sameModel(a, b) {
  const { as_of: _a, ...restA } = a;
  const { as_of: _b, ...restB } = b;
  return JSON.stringify(restA) === JSON.stringify(restB);
}
