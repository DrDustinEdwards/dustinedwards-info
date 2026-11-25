// Judges a parsed procedure against its profile (docs/PROCEDURES.md). check:content and the operator
// API's save_procedure both call it, so a file CI refuses is a file the save tool refuses, in the same words.
// A "MISSING: <why>" value passes and is returned as a gap; a bare MISSING or a missing required field is an error.

import { VERSION_PATTERN } from "./cite.mjs";
import { DOI_PATTERN } from "@drdustinedwards/site-helpers/scholar";
import { REGISTRY_ID, isGap } from "./gap.mjs";
import { SLUG_PATTERN } from "@drdustinedwards/site-helpers/slug";
import { proofErrors } from "./proof.mjs";
import { COURSES, METHODS, NON_STRAIN_ORGANISMS } from "./taxonomy.mjs";
import { BASES } from "../bases.mjs";
import { collectGaps } from "./validate-gaps.mjs";
import { computationalRules, protocolRules, recipeRules } from "./validate-profiles.mjs";
import { stepRules } from "./validate-steps.mjs";
import { nonEmptyString } from "./validate-values.mjs";

const PROFILES = /** @type {const} */ (["protocol", "recipe", "computational"]);

/** Where each profile's pages live (its knowledge base's root, app/kb/bases.mjs); the file's name is the last segment. */
const PROFILE_ROOTS = /** @type {Record<(typeof PROFILES)[number], string>} */ (
  Object.fromEntries(BASES.map((base) => [base.profile, base.entryRoot]))
);

const SEO_TITLE_MAX = 60;
const DESCRIPTION_MAX = 155;

/**
 * @param {Record<string, any>} d
 * @param {string[]} errors
 */
function validateHistory(d, errors) {
  if (d.history === undefined || isGap(d.history)) return;
  if (!Array.isArray(d.history) || d.history.length === 0) {
    errors.push("history must be a list of versions, newest first");
    return;
  }
  const seen = new Set();
  let newer = "9999-12-31";
  d.history.forEach((/** @type {any} */ h, /** @type {number} */ i) => {
    const at = `history[${h?.version ?? i}]`;
    if (!h || typeof h !== "object") return errors.push(`${at} must be a version`);
    for (const k of Object.keys(h))
      if (!["version", "date", "summary", "doi"].includes(k))
        errors.push(`${at}.${k} is not a history field (version, date, summary, doi)`);
    if (!VERSION_PATTERN.test(String(h.version ?? "")))
      errors.push(`${at} needs a version of letters, digits, dots, hyphens and underscores`);
    if (seen.has(String(h.version))) errors.push(`${at}: the version is listed twice`);
    seen.add(String(h.version));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(h.date ?? "")))
      errors.push(`${at}.date is ${JSON.stringify(h.date)}; write the date as YYYY-MM-DD`);
    else if (String(h.date) > newer)
      errors.push(
        `${at}.date ${h.date} is later than the entry above it; the history is newest first`,
      );
    else newer = String(h.date);
    if (!nonEmptyString(h.summary)) errors.push(`${at} needs a summary of what changed`);
    if (h.doi !== undefined && !DOI_PATTERN.test(String(h.doi)))
      errors.push(
        `${at}.doi is ${JSON.stringify(h.doi)}; write the DOI as 10.xxxx/suffix, without the https://doi.org/ address`,
      );
  });
  if (d.version === undefined || d.version === null || isGap(d.version)) {
    errors.push(
      "history needs a version: the first entry is the version the page is at, so set version to it",
    );
  } else if (String(d.history[0]?.version) !== String(d.version)) {
    errors.push(
      `version is ${JSON.stringify(d.version)} but the first history entry is ${JSON.stringify(String(d.history[0]?.version))}; the newest entry is the current version`,
    );
  }
}

/**
 * @param {import("./parse.mjs").ParsedProcedure} parsed
 * @param {{ slug: string, primers?: ReadonlySet<string> | null, strains?: ReadonlySet<string> | null, reagents?: ReadonlySet<string> | null, equipment?: ReadonlySet<string> | null }} expect the slug its file name gives, and the ids of the primers and
 *   host strains the lab registry holds (null or absent when the registry is not at hand, which `compileProcedure` refuses for a protocol that lists primers)
 * @returns {{ errors: string[], gaps: Array<{ field: string, reason: string, where?: string[], section?: string }> }}
 */
export function validateProcedure(parsed, expect) {
  /** @type {string[]} */
  const errors = [...parsed.problems];
  /** @type {Array<{ field: string, reason: string, where?: string[], section?: string }>} */
  const gaps = [];
  const d = parsed.data;
  const profile = /** @type {typeof PROFILES[number]} */ (d.profile);

  if (!PROFILES.includes(profile)) {
    errors.push(
      `profile is ${JSON.stringify(d.profile)}; it must be one of ${PROFILES.join(", ")}`,
    );
    return { errors, gaps };
  }

  /** @param {string} field */
  const required = (field) => {
    const value = d[field];
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      errors.push(
        `${field} is required for a ${profile}; write the value, or "MISSING: <why>" if nobody has it yet`,
      );
      return false;
    }
    return true;
  };

  collectGaps(d, "", gaps, errors);

  // Identity.
  const root = PROFILE_ROOTS[profile];
  if (required("path")) {
    if (typeof d.path !== "string" || d.path !== `${root}${expect.slug}`) {
      errors.push(
        `path is ${JSON.stringify(d.path)}; a ${profile} named ${expect.slug}.md lives at ${root}${expect.slug}`,
      );
    }
  }
  for (const field of ["title", "seo_title", "description"]) {
    if (required(field) && !nonEmptyString(d[field])) errors.push(`${field} must be text`);
  }
  if (typeof d.seo_title === "string" && d.seo_title.length > SEO_TITLE_MAX) {
    errors.push(
      `seo_title is ${d.seo_title.length} characters; Google clips near ${SEO_TITLE_MAX}`,
    );
  }
  if (typeof d.description === "string" && d.description.length > DESCRIPTION_MAX) {
    errors.push(
      `description is ${d.description.length} characters; Google clips near ${DESCRIPTION_MAX}`,
    );
  }
  if (d.draft !== undefined && typeof d.draft !== "boolean")
    errors.push("draft must be true or false");
  // A variant made with the editor's Duplicate names the procedure it was copied from, and the version it was copied at.
  if (d.forked_from !== undefined) {
    const f = d.forked_from;
    if (
      !f ||
      typeof f !== "object" ||
      Array.isArray(f) ||
      !SLUG_PATTERN.test(String(f.slug ?? ""))
    ) {
      errors.push(
        "forked_from is { slug, version }: the file name of the procedure this one was copied from, and its version if it had one",
      );
    } else {
      for (const key of Object.keys(f))
        if (!["slug", "version"].includes(key))
          errors.push(`forked_from.${key} is not a forked_from field (slug, version)`);
      if (f.slug === expect.slug) errors.push("forked_from names this procedure itself");
    }
  }

  // What the library filters by. method, organism and course are ids from the closed lists in taxonomy.mjs; target
  // is the gene, region or sample, in words. Every procedure is some method, so method is required.
  // An organism is a non-strain organism or a strain of the lab registry (docs/REGISTRY.md), read from it as the host strains are.
  const organisms = expect.strains
    ? [...Object.keys(NON_STRAIN_ORGANISMS), ...expect.strains]
    : null;
  for (const [field, vocabulary] of /** @type {const} */ ([
    ["method", METHODS],
    ["organism", null],
    ["course", COURSES],
  ])) {
    if (field === "method") required(field);
    const value = d[field];
    if (value === undefined || isGap(value)) continue;
    const allowed = vocabulary ? Object.keys(vocabulary) : organisms;
    // With no registry at hand an organism cannot be judged, and compileProcedure refuses a file that names one.
    if (!allowed) continue;
    if (!Array.isArray(value))
      errors.push(`${field} must be a list of ids from: ${allowed.join(", ")}`);
    else {
      for (const id of value) {
        if (allowed.includes(id)) continue;
        errors.push(
          vocabulary
            ? `${field} "${id}" is not one of: ${allowed.join(", ")} (taxonomy.mjs)`
            : `organism "${id}" is neither one of: ${Object.keys(NON_STRAIN_ORGANISMS).join(", ")} (taxonomy.mjs) nor a strain in the lab registry (there is no content/registry/strain/${id}.md)`,
        );
      }
      if (new Set(value).size !== value.length) errors.push(`${field} names one id twice`);
    }
  }
  if (d.target !== undefined && !isGap(d.target)) {
    if (!Array.isArray(d.target) || d.target.some((t) => !nonEmptyString(t)))
      errors.push(
        "target must be a list of the genes, regions or samples it works on, each in words",
      );
  }

  // Where it stands in the library's "Start here" list: a position (1, 2, ...), stored, never inferred. A position
  // two procedures share would make the order a guess, so the corpus check refuses it (checkStartHere).
  if (d.start_here !== undefined && !isGap(d.start_here)) {
    if (!Number.isInteger(d.start_here) || d.start_here < 1)
      errors.push("start_here must be a position in the Start here list: 1, 2, 3 ...");
  }

  // Proof of use: the papers that used the method and the phages it produced, as slugs. Stated, never inferred.
  if (!isGap(d.proof_of_use)) errors.push(...proofErrors(d.proof_of_use));

  // The shared core.
  if (required("version") && !isGap(d.version) && !VERSION_PATTERN.test(String(d.version))) {
    errors.push(
      `version is ${JSON.stringify(d.version)}; it sits in a URL, so use letters, digits, dots, hyphens and underscores, such as "2" or "1.1"`,
    );
  }
  validateHistory(d, errors);
  if (required("updated") && !isGap(d.updated) && !/^\d{4}-\d{2}-\d{2}$/.test(String(d.updated))) {
    errors.push(`updated is ${JSON.stringify(d.updated)}; write the date as YYYY-MM-DD`);
  }
  if (required("based_on") && !isGap(d.based_on)) {
    if (!Array.isArray(d.based_on)) errors.push("based_on must be a list of sources");
    else {
      d.based_on.forEach((/** @type {any} */ s, /** @type {number} */ i) => {
        if (!s || typeof s !== "object" || !nonEmptyString(s.citation))
          errors.push(`based_on[${i}] needs a citation`);
        else if (!nonEmptyString(s.for))
          errors.push(`based_on[${s.citation}] needs a "for": what it is the source of`);
        else if (s.url !== undefined && !/^(\/[^/\s]|https:\/\/\S)/.test(String(s.url)))
          errors.push(
            `based_on[${s.citation}].url is a page on this site (/...) or an https address`,
          );
        else if (s.doi !== undefined && !DOI_PATTERN.test(String(s.doi)))
          errors.push(`based_on[${s.citation}].doi is not a DOI`);
      });
    }
  }
  if (required("references") && !isGap(d.references)) {
    if (!Array.isArray(d.references) || d.references.some((r) => !nonEmptyString(r))) {
      errors.push("references must be a list of markdown lines");
    }
  }
  for (const field of ["expected_results", "limitations"]) {
    if (required(field) && !nonEmptyString(d[field])) errors.push(`${field} must be markdown text`);
  }
  if (d.time !== undefined) {
    if (!d.time || typeof d.time !== "object") errors.push("time must hold total and hands_on");
    else
      for (const k of Object.keys(d.time))
        if (!["total", "hands_on"].includes(k)) errors.push(`time.${k} is not a time field`);
  }

  // Materials and equipment.
  /** @type {Map<string, any>} */
  const materials = new Map();
  if (profile !== "recipe" || d.materials !== undefined) {
    if (required("materials")) {
      if (!Array.isArray(d.materials)) errors.push("materials must be a list");
      else {
        d.materials.forEach((/** @type {any} */ m, /** @type {number} */ i) => {
          if (!m || typeof m !== "object" || !nonEmptyString(m.name)) {
            errors.push(`materials[${i}] needs a name`);
            return;
          }
          const key = m.name.toLowerCase();
          if (materials.has(key)) errors.push(`materials lists "${m.name}" twice`);
          materials.set(key, m);
        });
      }
    }
  }
  if (d.equipment !== undefined && !Array.isArray(d.equipment))
    errors.push("equipment must be a list");
  // An item that is lab-registry equipment names it with `equipment: <id>` (docs/REGISTRY.md): the protocol keeps its own phrase for
  // it (the setting is the protocol's), and who makes it is stored there once.
  if (Array.isArray(d.equipment)) {
    for (const e of d.equipment) {
      if (typeof e !== "object" || e === null || e.equipment === undefined) continue;
      const at = `equipment[${String(e.name)}]`;
      if (typeof e.equipment !== "string" || !REGISTRY_ID.test(e.equipment)) {
        errors.push(
          `${at}.equipment is the id of an equipment item in the lab registry (content/registry/equipment/), such as water-bath`,
        );
      } else if (expect.equipment && !expect.equipment.has(e.equipment)) {
        errors.push(
          `${at}.equipment names no equipment in the lab registry (there is no content/registry/equipment/${e.equipment}.md)`,
        );
      }
    }
  }
  const equipmentNames = new Set(
    (Array.isArray(d.equipment) ? d.equipment : []).map((/** @type {any} */ e) =>
      String(typeof e === "string" ? e : (e?.name ?? "")).toLowerCase(),
    ),
  );

  // Troubleshooting.
  const troubleIds = new Set();
  if (d.troubleshooting !== undefined) {
    if (!Array.isArray(d.troubleshooting)) errors.push("troubleshooting must be a list of rows");
    else {
      d.troubleshooting.forEach((/** @type {any} */ row, /** @type {number} */ i) => {
        const at = `troubleshooting[${row?.id ?? i}]`;
        if (!row || typeof row !== "object") return errors.push(`${at} must be a row`);
        if (!/^[a-z0-9-]+$/.test(String(row.id ?? "")))
          errors.push(`${at} needs an id in lowercase-with-hyphens`);
        if (troubleIds.has(row.id)) errors.push(`${at}: the id is used twice`);
        troubleIds.add(row.id);
        for (const col of ["step", "problem", "reason", "solution"]) {
          if (!nonEmptyString(row[col]))
            errors.push(
              `${at} needs ${col}: the table's columns are step, problem, possible reason, solution`,
            );
        }
        for (const k of Object.keys(row)) {
          if (!["id", "step", "problem", "reason", "solution"].includes(k))
            errors.push(`${at}.${k} is not a column`);
        }
      });
    }
  }

  stepRules(parsed, profile, errors, gaps, materials, equipmentNames, troubleIds);

  // The profiles.
  // A recipe's density, so its volume can be shown as weight: a number the recipe states, never a table's (DECIDE 7).
  for (const m of Array.isArray(d.materials) ? d.materials : []) {
    if (m?.grams_per_cup === undefined) continue;
    const at = `materials[${String(m.name)}].grams_per_cup`;
    if (profile !== "recipe") errors.push(`${at} belongs to the recipe profile`);
    else if (typeof m.grams_per_cup !== "number" || !(m.grams_per_cup > 0))
      errors.push(`${at} is the grams in one US cup of it, a number above 0`);
  }
  if (profile === "protocol")
    protocolRules(
      d,
      errors,
      required,
      materials,
      expect.primers ?? null,
      expect.strains ?? null,
      expect.reagents ?? null,
    );
  if (profile === "recipe") recipeRules(d, errors, required);
  if (profile === "computational") computationalRules(d, errors, required, materials);
  else {
    for (const field of ["type", "questions", "objectives", "key_points", "explanation"]) {
      if (d[field] !== undefined) errors.push(`${field} belongs to the computational profile`);
    }
  }

  return { errors, gaps };
}
