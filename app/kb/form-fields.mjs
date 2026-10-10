// What the Knowledge Base form shows for each front-matter field (docs/KNOWLEDGE-BASE.md): its label, the input it is
// edited with and, for a choice, the closed list it is chosen from. The lists are the ones the validator holds a file to
// (taxonomy.mjs, validate.mjs), so the form cannot offer a value the save would refuse. A field not named here is still
// edited, as YAML, so nothing in a file is out of the form's reach.

import { BIOSAFETY_LEVELS } from "./procedures/validate.mjs";
import { COURSES, METHODS, NON_STRAIN_ORGANISMS, PROTOCOL_STATUSES } from "./procedures/taxonomy.mjs";

/**
 * @typedef {"text" | "textarea" | "lines" | "date" | "number" | "checkbox" | "select" | "multi" | "choice" | "materials" | "equipment" | "primers" | "strains" | "readonly" | "yaml"} FieldKind
 * @typedef {{ key: string, label: string, kind: FieldKind, help?: string, options?: Array<{ value: string, label: string }> }} FieldSpec
 */

/** @param {Record<string, string | { label: string }>} map */
const options = (map) => Object.entries(map).map(([value, label]) => ({ value, label: typeof label === "string" ? label : label.label }));

/** Every profile's fields first, in the order a person fills them in. @type {FieldSpec[]} */
const COMMON = [
  { key: "title", label: "Title", kind: "text" },
  { key: "seo_title", label: "Search title", kind: "text", help: "The title search engines show; at most 60 characters." },
  { key: "description", label: "Description", kind: "textarea", help: "One sentence, at most 155 characters." },
  { key: "draft", label: "Draft (only you can see it)", kind: "checkbox" },
  { key: "version", label: "Version", kind: "text", help: "Letters, digits, dots and hyphens, such as 2 or 1.1. A version, once published, is frozen." },
  { key: "updated", label: "Updated", kind: "date" },
];

/** @type {FieldSpec[]} */
const PROTOCOL = [
  { key: "status", label: "Status", kind: "select", options: options(PROTOCOL_STATUSES) },
  { key: "biosafety_level", label: "Biosafety level", kind: "choice", options: BIOSAFETY_LEVELS.map((v) => ({ value: v, label: v })) },
  { key: "method", label: "Method", kind: "multi", options: options(METHODS) },
  { key: "course", label: "Courses", kind: "multi", options: options(COURSES) },
  { key: "organism", label: "Organisms", kind: "multi" },
  { key: "target", label: "Targets", kind: "lines", help: "One per line: a gene, region or sample." },
  { key: "first_used", label: "First used", kind: "text" },
  { key: "last_run", label: "Last run", kind: "date" },
  { key: "start_here", label: "Start-here position", kind: "number", help: "Its place in the library's Start here list; leave empty for none." },
  { key: "host_strain", label: "Host strains", kind: "strains" },
  { key: "primers", label: "Primers", kind: "primers" },
  { key: "materials", label: "Reagents", kind: "materials" },
  { key: "equipment", label: "Equipment", kind: "equipment" },
  { key: "biosafety", label: "Biosafety agent", kind: "yaml", help: "The agent only: { organism, strain, atcc }, or not applicable." },
  { key: "expected_results", label: "Expected results", kind: "textarea" },
  { key: "limitations", label: "Limitations", kind: "textarea" },
];

/** @type {FieldSpec[]} */
const RECIPE = [
  { key: "servings", label: "Servings", kind: "number" },
  { key: "prep_time", label: "Prep time", kind: "text" },
  { key: "cook_time", label: "Cook time", kind: "text" },
  { key: "cuisine", label: "Cuisine", kind: "text" },
  { key: "category", label: "Category", kind: "text" },
  { key: "diet", label: "Diet", kind: "lines" },
  { key: "materials", label: "Ingredients", kind: "materials" },
  { key: "equipment", label: "Equipment", kind: "equipment" },
];

/** @type {FieldSpec[]} */
const COMPUTATIONAL = [
  { key: "method", label: "Method", kind: "multi", options: options(METHODS) },
  { key: "course", label: "Courses", kind: "multi", options: options(COURSES) },
  { key: "environment", label: "Environment", kind: "textarea" },
  { key: "prerequisites", label: "Prerequisites", kind: "lines" },
  { key: "materials", label: "Software and data", kind: "materials" },
  { key: "expected_results", label: "Expected results", kind: "textarea" },
  { key: "limitations", label: "Limitations", kind: "textarea" },
];

/** Shown, never edited: a procedure's profile and address are its file's name and place (the validator ties them). */
const FIXED = [
  { key: "profile", label: "Profile", kind: /** @type {const} */ ("readonly") },
  { key: "path", label: "Address", kind: /** @type {const} */ ("readonly") },
  { key: "forked_from", label: "Copied from", kind: /** @type {const} */ ("readonly") },
];

/**
 * The fields of an entry of `profile`, then every other field the file has, as YAML. The organism list is the registry's
 * strains and the non-strain organisms, the list the validator holds `organism` to.
 *
 * @param {string} profile
 * @param {Record<string, unknown>} data
 * @param {Array<{ value: string, label: string }>} strains
 * @returns {FieldSpec[]}
 */
export function entryFields(profile, data, strains) {
  const own = profile === "recipe" ? RECIPE : profile === "computational" ? COMPUTATIONAL : PROTOCOL;
  /** @type {FieldSpec[]} */
  const specs = [...FIXED, ...COMMON, ...own].map((spec) =>
    spec.key === "organism" ? { ...spec, options: [...strains, ...options(NON_STRAIN_ORGANISMS)] } : spec,
  );
  const named = new Set(specs.map((s) => s.key));
  const rest = Object.keys(data)
    .filter((key) => !named.has(key))
    .map((key) => ({ key, label: key.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase()), kind: /** @type {const} */ ("yaml") }));
  return [...specs, ...rest];
}

/**
 * A registry item's fields: its name, whether it is a draft, then every field its kind declares. A field that holds true
 * or false is a checkbox; every other is text, since a kind's fields are words (docs/REGISTRY.md).
 *
 * @param {string[]} declared
 * @param {Record<string, unknown>} data
 * @returns {FieldSpec[]}
 */
export function itemFields(declared, data) {
  return [
    { key: "name", label: "Name", kind: "text" },
    { key: "draft", label: "Draft (only you can see it)", kind: "checkbox" },
    ...declared.map((key) => ({
      key,
      label: key.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase()),
      kind: /** @type {FieldKind} */ (typeof data[key] === "boolean" || key.startsWith("prepared_") ? "checkbox" : "text"),
    })),
  ];
}

/** A recorded gap's reason, or null for a value. @param {unknown} value */
export function gapReason(value) {
  const match = typeof value === "string" ? /^MISSING:\s*([\s\S]+)$/.exec(value) : null;
  return match ? /** @type {string} */ (match[1]) : null;
}
