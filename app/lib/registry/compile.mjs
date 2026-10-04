// The one door from a registry file to the row the registry is drawn from (docs/REGISTRY.md): parse, validate, hash.
// build:content, sync:content, the gates and the adapter's registry save all call compileRegistryItem, so a file CI
// passes is the file the save accepts. Pure and dependency-light, so the Worker and the Node scripts import the same
// module.
//
// An item is ONE file, `content/registry/<kind>/<id>.md`, and the file is its front matter and nothing else. What
// every kind has (a name, and `draft` for its status) is the table's own columns; what a kind knows beyond that is its `fields`
// (app/lib/registry/kinds.mjs), judged by that kind's rules. The validator REFUSES any field the kind does not
// declare, so nothing enters the repository or D1 that a page would not show, and it states a value nobody has yet
// as "MISSING: <why>", never a guess.

import matter from "gray-matter";

import { gitBlobSha } from "../content/hashes.mjs";
import { foldText } from "../cv/view.mjs";
import { KINDS, kindKeys } from "./kinds.mjs";

export const REGISTRY_DIR = "content/registry";

/** An id within a kind: lower-case letters, digits and hyphens, so it is a file name and a URL segment as written. */
export const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;
/** A kind is a key of KINDS: the same shape, so it is a directory and a URL segment as written. */
const KIND_PATTERN = /^[a-z][a-z-]{0,30}$/;
export const NAME_MAX = 120;

const GAP = /^MISSING:\s*(\S.*)$/s;

/** True for a recorded gap: `MISSING: <why>`. @param {unknown} value @returns {value is string} */
export function isGap(value) {
  return typeof value === "string" && GAP.test(value);
}

/** The registry address of an item, `<kind>/<id>`: what the drift check, the sync and Carrel read it by. */
export function registrySlug(/** @type {string} */ kind, /** @type {string} */ id) {
  return `${kind}/${id}`;
}

/**
 * The kind and id a slug names, or null when it is not exactly `<kind>/<id>` in the allowed shapes, so a slug can
 * never name another path.
 *
 * @param {string} slug
 * @returns {{ kind: string, id: string } | null}
 */
export function parseRegistrySlug(slug) {
  const parts = slug.split("/");
  if (parts.length !== 2) return null;
  const [kind = "", id = ""] = parts;
  return KIND_PATTERN.test(kind) && ID_PATTERN.test(id) ? { kind, id } : null;
}

/** The repository path of an item's file, from its slug. */
export function registryPath(/** @type {string} */ slug) {
  return `${REGISTRY_DIR}/${slug}.md`;
}

/**
 * @typedef {import("./kinds.mjs").KindSpec} KindSpec
 * @typedef {import("./kinds.mjs").RegistryItem} RegistryItem
 * @typedef {import("./kinds.mjs").RegistryHost} RegistryHost
 * `findWideDashes` is injected, as the page compile injects the pipeline's: the Worker loads it lazily.
 * @typedef {{ findWideDashes: (text: string) => Array<{ line: number, column: number, char: string, excerpt: string }> }} RegistryPipeline
 */

/**
 * Judges one file and, when it passes, builds the item. Every message the file has is returned, never the first
 * alone, so a writer fixes all of them at once.
 *
 * @param {{ slug: string, raw: string, host: RegistryHost, pipeline: RegistryPipeline, kinds?: Readonly<Record<string, KindSpec>>, sourcePath?: string }} input
 * @returns {Promise<
 *   | { ok: false, errors: string[] }
 *   | { ok: true, errors: [], item: RegistryItem, record: string, gaps: Array<{ field: string, reason: string }>, sourcePath: string, sourceBlobSha: string }
 * >}
 */
export async function compileRegistryItem({ slug, raw, host, pipeline, kinds = KINDS, sourcePath }) {
  /** @type {string[]} */
  const errors = pipeline
    .findWideDashes(raw)
    .map((hit) => `line ${hit.line}, column ${hit.column}: wide dash ${hit.char}; house style uses commas, periods, parentheses or colons ("${hit.excerpt}")`);

  const address = parseRegistrySlug(slug);
  if (!address) {
    return { ok: false, errors: [...errors, `"${slug}" is not a registry address; it is <kind>/<id>, such as ${kindKeys(kinds)[0] ?? "primer"}/m13-forward (lower-case letters, digits and hyphens)`] };
  }
  const { kind, id } = address;
  const spec = kinds[kind];
  if (!spec) {
    return { ok: false, errors: [...errors, `"${kind}" is not a registry kind; the kinds are ${kindKeys(kinds).join(", ") || "none yet"}`] };
  }
  if (!raw.startsWith("---")) errors.push("the file must start with a --- front matter block");

  let parsed;
  try {
    // An options object, even an empty one: gray-matter caches by input when it is omitted.
    parsed = matter(raw, {});
  } catch (error) {
    return { ok: false, errors: [...errors, `the front matter is not valid YAML: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`] };
  }
  const data = /** @type {Record<string, unknown>} */ (parsed.data);
  if (parsed.content.trim() !== "") errors.push(`the body must be empty: a ${spec.singular} is its front matter and nothing else`);

  const allowed = ["name", "draft", ...Object.keys(spec.fields)];
  for (const key of Object.keys(data)) {
    if (!allowed.includes(key)) errors.push(`${key} is not a ${spec.singular} field; a ${spec.singular} carries ${allowed.join(", ")} and nothing else`);
  }

  const { name, draft } = data;
  if (typeof name !== "string" || name.trim() === "" || name !== name.trim() || /[\r\n]/.test(name) || name.length > NAME_MAX) {
    errors.push(`name is ${JSON.stringify(name)}; it is the ${spec.singular}'s name on one line, at most ${NAME_MAX} characters`);
  }
  if (draft !== undefined && typeof draft !== "boolean") {
    errors.push(`draft is ${JSON.stringify(draft)}; it is true or false, or absent for a published item`);
  }

  /** @type {Record<string, unknown>} */
  const fields = {};
  /** @type {Array<{ field: string, reason: string }>} */
  const gaps = [];
  for (const [field, fieldSpec] of Object.entries(spec.fields)) {
    const value = data[field];
    if (value === undefined || value === null) {
      if (fieldSpec.required) errors.push(`${field} is required for a ${spec.singular}; write the value, or "MISSING: <why>" if nobody has it yet`);
      fields[field] = null;
      continue;
    }
    if (typeof value === "string" && /^MISSING\b/.test(value) && !isGap(value)) {
      errors.push(`${field} is ${JSON.stringify(value)}; write MISSING: and the reason it is missing`);
      continue;
    }
    if (isGap(value)) {
      gaps.push({ field, reason: value.replace(/^MISSING:\s*/, "") });
      fields[field] = value;
      continue;
    }
    const message = await fieldSpec.check(value, { host, data });
    if (message) errors.push(`${field}: ${message}`);
    fields[field] = value;
  }
  if (errors.length > 0) return { ok: false, errors };

  /** @type {RegistryItem} */
  const item = {
    kind,
    id,
    name: /** @type {string} */ (name),
    status: draft === true ? "draft" : "published",
    fields,
  };
  return {
    ok: true,
    errors: [],
    item,
    // Only what the shared columns do not hold: a name is stored once, in its column.
    record: JSON.stringify(fields),
    gaps,
    sourcePath: sourcePath ?? registryPath(slug),
    sourceBlobSha: await gitBlobSha(raw),
  };
}

/**
 * What only the whole set can say: two items of a kind cannot share a name (folded, so case and accents do not make
 * two), and a kind's own rules about its set. An empty set is not a fault: the registry has no records until a kind
 * brings its own.
 *
 * @param {RegistryItem[]} items
 * @param {Readonly<Record<string, KindSpec>>} [kinds]
 * @returns {string[]}
 */
export function registrySetErrors(items, kinds = KINDS) {
  /** @type {string[]} */
  const errors = [];
  /** @type {Map<string, string>} */
  const names = new Map();
  for (const { kind, id, name } of items) {
    const key = `${kind}\u0000${foldText(name)}`;
    const other = names.get(key);
    if (other !== undefined) errors.push(`${kind}/${id} and ${kind}/${other} are both named "${name}"`);
    else names.set(key, id);
  }
  for (const [kind, spec] of Object.entries(kinds)) {
    const mine = items.filter((item) => item.kind === kind);
    if (spec.setErrors) errors.push(...spec.setErrors(mine));
  }
  return errors;
}

/**
 * The items in the site's order: kinds as they are defined, then name folded so case and accents do not matter.
 *
 * @param {RegistryItem[]} items
 * @param {Readonly<Record<string, KindSpec>>} [kinds]
 */
export function sortRegistry(items, kinds = KINDS) {
  const order = new Map(kindKeys(kinds).map((kind, i) => [kind, i]));
  return [...items].sort(
    (a, b) =>
      (order.get(a.kind) ?? 0) - (order.get(b.kind) ?? 0) ||
      foldText(a.name).localeCompare(foldText(b.name), "en", { numeric: true }),
  );
}

/**
 * An item from a row of the table: the shared columns, and the kind's fields from `record`.
 *
 * @param {{ kind: string, id: string, name: string, status: string, record: string }} row
 * @returns {RegistryItem}
 */
export function itemFromRow(row) {
  return {
    kind: row.kind,
    id: row.id,
    name: row.name,
    status: row.status === "draft" ? "draft" : "published",
    fields: JSON.parse(row.record),
  };
}
