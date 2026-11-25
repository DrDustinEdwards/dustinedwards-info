/** The rules that belong to one profile only: protocol, recipe, computational. */

import { REGISTRY_ID, isGap } from "./gap.mjs";
import { PROTOCOL_STATUSES } from "./taxonomy.mjs";
import { PROTOCOL_QUANTITY, PROTOCOL_UNITS, nonEmptyString } from "./validate-values.mjs";

const NOT_APPLICABLE = "not applicable";

/** A software how-to's form, per Diátaxis (docs/KNOWLEDGE-BASE.md, S1): a lesson that teaches, or a recipe for a task. */
export const HOWTO_TYPES = /** @type {const} */ ({ tutorial: "Tutorial", "how-to": "How-to" });

/** The levels a protocol's `biosafety_level` may name; each is Dustin's to set. */
export const BIOSAFETY_LEVELS = ["BSL-1", "BSL-2"];

/** Words kept off a protocol's `biosafety` note: the agent only. The separate `biosafety_level` field holds the level. */
const BIOSAFETY_BANNED = /\b(BSL|biosafety level|IBC|NIH)\b/i;

/**
 * @param {Record<string, any>} d
 * @param {string[]} errors
 * @param {(field: string) => boolean} required
 * @param {Map<string, any>} materials
 * @param {ReadonlySet<string> | null} primerIds the primers the lab registry holds
 * @param {ReadonlySet<string> | null} strainIds the strains the lab registry holds
 * @param {ReadonlySet<string> | null} reagentIds the reagents the lab registry holds
 */
export function protocolRules(d, errors, required, materials, primerIds, strainIds, reagentIds) {
  for (const field of [
    "host_strain",
    "status",
    "last_run",
    "biosafety",
    "biosafety_level",
    "scale",
  ])
    required(field);
  // A host strain is the lab registry's, named by id and never typed (docs/REGISTRY.md): its organism, designation and
  // collection number are stored once, on its record.
  if (d.host_strain !== undefined && d.host_strain !== NOT_APPLICABLE && !isGap(d.host_strain)) {
    if (!Array.isArray(d.host_strain))
      errors.push(
        `host_strain must be a list of { strain: <id> }, "${NOT_APPLICABLE}" or "MISSING: <why>"`,
      );
    else {
      /** @type {Set<string>} */
      const seenStrains = new Set();
      for (const s of d.host_strain) {
        const id = s?.strain;
        const at = `host_strain[${typeof id === "string" ? id : "?"}]`;
        if (typeof id !== "string" || !REGISTRY_ID.test(id)) {
          errors.push(
            `${at} is { strain: <id> }: the id of a strain in the lab registry (content/registry/strain/), such as foliorum. A protocol names its host strains and types none`,
          );
        } else if (seenStrains.has(id)) {
          errors.push(`${at} is listed twice`);
        } else {
          seenStrains.add(id);
          if (strainIds && !strainIds.has(id))
            errors.push(
              `${at} names no strain in the lab registry (there is no content/registry/strain/${id}.md)`,
            );
        }
        for (const key of Object.keys(s ?? {})) {
          if (key !== "strain")
            errors.push(
              `${at}.${key} is not a protocol field: a strain's organism and collection number are stored once, in the lab registry`,
            );
        }
      }
    }
  }
  if (
    d.status !== undefined &&
    !isGap(d.status) &&
    !Object.keys(PROTOCOL_STATUSES).includes(d.status)
  ) {
    errors.push(
      `status is ${JSON.stringify(d.status)}; it is one of ${Object.keys(PROTOCOL_STATUSES).join(", ")} (taxonomy.mjs), or "MISSING: <why>"`,
    );
  }
  if (
    d.biosafety_level !== undefined &&
    !isGap(d.biosafety_level) &&
    !BIOSAFETY_LEVELS.includes(d.biosafety_level)
  ) {
    errors.push(
      `biosafety_level is ${JSON.stringify(d.biosafety_level)}; it is one of ${BIOSAFETY_LEVELS.join(", ")}, or "MISSING: <why>" until Dustin sets it`,
    );
  }
  if (d.biosafety && !isGap(d.biosafety) && d.biosafety !== NOT_APPLICABLE) {
    if (typeof d.biosafety !== "object" || !nonEmptyString(d.biosafety.organism)) {
      errors.push(
        'biosafety lists the agent only: { organism, strain, atcc }, or "not applicable"',
      );
    } else {
      for (const k of Object.keys(d.biosafety)) {
        if (!["organism", "strain", "atcc"].includes(k))
          errors.push(`biosafety.${k}: the agent only (organism, strain, ATCC number)`);
      }
    }
  }
  if (BIOSAFETY_BANNED.test(JSON.stringify(d.biosafety ?? ""))) {
    errors.push(
      "biosafety names a biosafety level, an IBC or the NIH Guidelines; it lists the agent only",
    );
  }
  if (d.scale && !isGap(d.scale)) {
    if (
      typeof d.scale !== "object" ||
      !(Number(d.scale.count) > 0) ||
      !nonEmptyString(d.scale.unit)
    ) {
      errors.push("scale needs a count and a unit, such as { count: 5, unit: tube }");
    }
  }
  const solutionIds = new Set();
  if (d.solutions !== undefined) {
    if (!Array.isArray(d.solutions)) errors.push("solutions must be a list");
    else {
      for (const s of d.solutions) {
        const at = `solutions[${s?.id ?? "?"}]`;
        if (!s || !/^[a-z0-9-]+$/.test(String(s.id ?? "")))
          errors.push(`${at} needs an id in lowercase-with-hyphens`);
        solutionIds.add(s?.id);
        if (!nonEmptyString(s?.name)) errors.push(`${at} needs a name`);
        if (!Array.isArray(s?.components) || s.components.length === 0)
          errors.push(`${at} needs its components`);
        for (const field of ["storage", "shelf_life"]) {
          if (!nonEmptyString(s?.[field])) errors.push(`${at} needs ${field}, or "MISSING: <why>"`);
        }
        for (const c of Array.isArray(s?.components) ? s.components : []) {
          if (!nonEmptyString(c?.name)) errors.push(`${at} has a component with no name`);
          for (const q of ["final", "amount"]) {
            if (c?.[q] !== undefined && !isGap(c[q]) && !PROTOCOL_QUANTITY.test(String(c[q]))) {
              errors.push(
                `${at}.${c.name}.${q} is "${c[q]}", not a number and a unit from the closed list`,
              );
            }
          }
        }
      }
    }
  }
  for (const m of materials.values()) {
    const at = `materials[${m.name}]`;
    // A material that is a reagent of the lab registry names it by id (docs/REGISTRY.md): who supplies it and its catalog number
    // are stored there once, and the protocol keeps its own amount, stock and final.
    if (m.reagent !== undefined) {
      if (typeof m.reagent !== "string" || !REGISTRY_ID.test(m.reagent)) {
        errors.push(
          `${at}.reagent is the id of a reagent in the lab registry (content/registry/reagent/), such as zinc-chloride`,
        );
      } else if (reagentIds && !reagentIds.has(m.reagent)) {
        errors.push(
          `${at}.reagent names no reagent in the lab registry (there is no content/registry/reagent/${m.reagent}.md)`,
        );
      }
    }
    for (const key of ["amount", "final", "per"]) {
      const q = m[key];
      if (q === undefined || isGap(q)) continue;
      if (key === "per" && typeof q === "string" && !/^\d/.test(q)) continue;
      if (typeof q !== "string" || !PROTOCOL_QUANTITY.test(q)) {
        errors.push(
          `${at}.${key} is "${String(q)}", not a number and a unit from the closed list (${PROTOCOL_UNITS.join(", ")})`,
        );
      }
    }
    if (m.stock !== undefined) {
      const stocks = Array.isArray(m.stock) ? m.stock : [m.stock];
      for (const s of stocks) {
        if (!isGap(s) && !PROTOCOL_QUANTITY.test(String(s)))
          errors.push(`${at}.stock "${s}" is not a number and a unit from the closed list`);
      }
    }
    if (m.solution !== undefined && !solutionIds.has(m.solution))
      errors.push(`${at}.solution names "${m.solution}", which is not in solutions`);
  }
  if (d.primers !== undefined && d.primers !== NOT_APPLICABLE && !isGap(d.primers)) {
    if (!Array.isArray(d.primers)) errors.push(`primers must be a list, or "${NOT_APPLICABLE}"`);
    else {
      /** @type {Set<string>} */
      const seen = new Set();
      for (const p of d.primers) {
        const id = p?.primer;
        const at = `primers[${typeof id === "string" ? id : "?"}]`;
        if (typeof id !== "string" || !REGISTRY_ID.test(id)) {
          errors.push(
            `${at} is { primer: <id> }: the id of a primer in the lab registry (content/registry/primer/), such as lco1490. A protocol names its primers and stores no sequence`,
          );
        } else if (seen.has(id)) {
          errors.push(`${at} is listed twice`);
        } else {
          seen.add(id);
          if (primerIds && !primerIds.has(id))
            errors.push(
              `${at} names no primer in the lab registry (there is no content/registry/primer/${id}.md)`,
            );
        }
        for (const key of Object.keys(p ?? {})) {
          if (key !== "primer")
            errors.push(
              `${at}.${key} is not a protocol field: a primer's sequence, direction and set are stored once, in the lab registry`,
            );
        }
      }
    }
  }
  if (d.cycling !== undefined) {
    if (!Array.isArray(d.cycling)) errors.push("cycling must be a list of programs");
    else {
      const walk = (/** @type {any} */ stage, /** @type {string} */ at) => {
        if (Array.isArray(stage?.steps))
          stage.steps.forEach((/** @type {any} */ s, /** @type {number} */ i) =>
            walk(s, `${at}.steps[${i}]`),
          );
        if (
          typeof stage?.temperature_c === "string" &&
          /^\d+ to \d+$/.test(stage.temperature_c) &&
          stage.touchdown_step_c === undefined
        ) {
          errors.push(
            `${at} is a touchdown (${stage.temperature_c} °C) with no touchdown_step_c; write it, or "MISSING: <why>"`,
          );
        }
      };
      d.cycling.forEach((/** @type {any} */ program, /** @type {number} */ i) => {
        const at = `cycling[${program?.set ?? i}]`;
        if (!Array.isArray(program?.program))
          errors.push(`${at} needs its program: a list of stages`);
        else
          program.program.forEach((/** @type {any} */ stage, /** @type {number} */ j) =>
            walk(stage, `${at}.program[${stage?.stage ?? j}]`),
          );
      });
    }
  }
}

/**
 * @param {Record<string, any>} d
 * @param {string[]} errors
 * @param {(field: string) => boolean} required
 */
export function recipeRules(d, errors, required) {
  for (const field of ["servings", "cuisine", "category", "prep_time", "cook_time", "image"])
    required(field);
  if (d.servings !== undefined && !isGap(d.servings) && !(Number(d.servings) > 0))
    errors.push("servings must be a number");
  for (const field of ["prep_time", "cook_time"]) {
    if (
      d[field] !== undefined &&
      !isGap(d[field]) &&
      !/^\d+(?:\.\d+)? (minutes?|hours?)$/.test(String(d[field]))
    ) {
      errors.push(`${field} is "${d[field]}"; write it as "20 minutes" or "1.5 hours"`);
    }
  }
  if (
    d.image !== undefined &&
    !isGap(d.image) &&
    (!nonEmptyString(d.image?.src) || !nonEmptyString(d.image?.alt))
  ) {
    errors.push("image needs src and alt");
  }
  if (d.substitutions !== undefined) {
    if (!Array.isArray(d.substitutions)) errors.push("substitutions must be a list");
    else
      for (const s of d.substitutions)
        if (!nonEmptyString(s?.for) || !nonEmptyString(s?.use))
          errors.push("each substitution needs for and use");
  }
  if (d.scale !== undefined) errors.push("a recipe scales by servings, not scale");
}

/**
 * @param {Record<string, any>} d
 * @param {string[]} errors
 * @param {(field: string) => boolean} required
 * @param {Map<string, any>} materials
 */
export function computationalRules(d, errors, required, materials) {
  required("environment");
  if (required("type") && !Object.hasOwn(HOWTO_TYPES, d.type)) {
    errors.push(
      `type is ${JSON.stringify(d.type)}; it is one of ${Object.keys(HOWTO_TYPES).join(", ")}`,
    );
  }
  // A tutorial opens as a Carpentries episode does: what it answers, what the reader will be able to do, and how long (S2).
  for (const field of ["questions", "objectives", "key_points"]) {
    if (d[field] === undefined || isGap(d[field])) continue;
    if (!Array.isArray(d[field]) || d[field].some((/** @type {unknown} */ x) => !nonEmptyString(x)))
      errors.push(`${field} must be a list of lines`);
  }
  if (d.type === "tutorial") {
    required("objectives");
    if (!d.time || !nonEmptyString(d.time.total))
      errors.push("a tutorial states its time: time.total, such as 30 minutes");
  }
  if (d.explanation !== undefined && !isGap(d.explanation)) {
    if (!Array.isArray(d.explanation))
      errors.push("explanation must be a list of pages, each with a title and a url");
    else {
      d.explanation.forEach((/** @type {any} */ e, /** @type {number} */ i) => {
        if (!e || typeof e !== "object" || !nonEmptyString(e.title))
          errors.push(`explanation[${i}] needs a title`);
        else if (typeof e.url !== "string" || !/^(\/[^/\s]|https:\/\/\S)/.test(e.url))
          errors.push(
            `explanation[${e.title}].url is a page on this site (/...) or an https address`,
          );
      });
    }
  }
  if (required("prerequisites") && !isGap(d.prerequisites) && !Array.isArray(d.prerequisites)) {
    errors.push("prerequisites must be a list");
  }
  if (d.scale !== undefined || d.servings !== undefined)
    errors.push("a computational procedure does not scale");
  for (const m of materials.values()) {
    if (!["software", "data", "file"].includes(m.kind))
      errors.push(`materials[${m.name}].kind must be software, data or file`);
    if (m.kind === "software" && !nonEmptyString(m.version))
      errors.push(`materials[${m.name}] is software and needs its version`);
  }
}
