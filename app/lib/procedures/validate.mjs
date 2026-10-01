// Judges a parsed procedure against its profile (docs/PROCEDURES.md). check:protocols and the operator
// API's save_procedure both call validateProcedure, so a file CI refuses is a file the save tool refuses,
// for the same reason in the same words.
//
// A value nobody has yet is written "MISSING: <why>" in place. It passes and is returned as a gap, so
// the check can print it and the read tool can show it. A bare MISSING, or a required field left out,
// is an error: a forgotten field cannot pass as a recorded gap.

import { allSteps, stepConditions } from "./parse.mjs";

export const PROFILES = /** @type {const} */ (["protocol", "recipe", "computational"]);

/** Where each profile's pages live; the file's name is the last segment. */
export const PROFILE_ROOTS = /** @type {const} */ ({
  protocol: "/research/protocols/",
  recipe: "/recipes/",
  computational: "/research/methods/",
});

export const NOT_APPLICABLE = "not applicable";

/** protocols.md: "units are a closed list". A unit outside it fails until it is added here on purpose. */
export const PROTOCOL_UNITS = [
  "µl", "µL", "ml", "mL", "l", "L", "M", "mM", "µM", "nM", "mg/ml", "µg/ml", "ng/µl", "%", "U", "g", "mg", "µg", "ng",
  "volume", "volumes", "tube", "tubes", "reaction", "reactions", "plate", "plates", "x",
];
export const TIME_UNITS = ["second", "seconds", "sec", "s", "minute", "minutes", "min", "hour", "hours", "h", "day", "days"];

/** A recorded gap: the marker and the reason, never the marker alone. */
const GAP = /^MISSING:\s*(\S.*)$/s;

/** Words protocols.md keeps off a protocol's biosafety note: the agent only. */
const BIOSAFETY_BANNED = /\b(BSL|biosafety level|IBC|NIH)\b/i;

const IUPAC = /^[ACGTRYSWKMBDHVN]+$/;

const SEO_TITLE_MAX = 60;
const DESCRIPTION_MAX = 155;

/**
 * @param {unknown} value
 */
function isGap(value) {
  return typeof value === "string" && GAP.test(value);
}

/**
 * @param {Record<string, unknown>} item
 * @param {number} index
 */
function label(item, index) {
  for (const key of ["id", "name", "set", "citation", "for"]) {
    if (typeof item[key] === "string" && item[key]) return /** @type {string} */ (item[key]);
  }
  return String(index);
}

/**
 * Every recorded gap under `value`, by path.
 *
 * @param {unknown} value
 * @param {string} path
 * @param {Array<{ field: string, reason: string }>} gaps
 * @param {string[]} errors
 */
function collectGaps(value, path, gaps, errors) {
  if (typeof value === "string") {
    const m = GAP.exec(value);
    if (m) gaps.push({ field: path, reason: (m[1] ?? "").trim() });
    else if (/^MISSING\b/.test(value)) errors.push(`${path} is "${value}": write MISSING: and the reason it is missing`);
  } else if (Array.isArray(value)) {
    value.forEach((item, i) =>
      collectGaps(item, `${path}[${item && typeof item === "object" ? label(item, i) : i}]`, gaps, errors),
    );
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) collectGaps(v, `${path}.${k}`, gaps, errors);
  }
}

/**
 * "250 µl", "0.5 ml", "100% or 80%", "1.25 to 5 µl", "2.5 volumes".
 *
 * @param {string[]} units
 */
function quantityPattern(units) {
  const number = String.raw`\d[\d,]*(?:\.\d+)?`;
  const unit = units.map((u) => u.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|");
  return new RegExp(`^${number}(?: ?(?:${unit}))?(?: (?:to|or) ${number})? ?(?:${unit})$`);
}

const PROTOCOL_QUANTITY = quantityPattern(PROTOCOL_UNITS);

/**
 * Every word the page's body carries: the intro, the prose and the steps.
 *
 * @param {import("./parse.mjs").ParsedProcedure} parsed
 */
function bodyText(parsed) {
  const blocks = parsed.sections.flatMap((s) => s.blocks);
  return [parsed.intro, ...blocks.map((b) => (b.type === "prose" ? b.markdown : b.steps.map((x) => x.source).join(" ")))].join(" ");
}

/**
 * @param {unknown} value
 */
function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Checks one parsed procedure.
 *
 * @param {import("./parse.mjs").ParsedProcedure} parsed
 * @param {{ slug: string }} expect the slug its file name gives
 * @returns {{ errors: string[], gaps: Array<{ field: string, reason: string }> }}
 */
export function validateProcedure(parsed, expect) {
  /** @type {string[]} */
  const errors = [...parsed.problems];
  /** @type {Array<{ field: string, reason: string }>} */
  const gaps = [];
  const d = parsed.data;
  const profile = /** @type {typeof PROFILES[number]} */ (d.profile);

  if (!PROFILES.includes(profile)) {
    errors.push(`profile is ${JSON.stringify(d.profile)}; it must be one of ${PROFILES.join(", ")}`);
    return { errors, gaps };
  }

  /** @param {string} field */
  const required = (field) => {
    const value = d[field];
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
      errors.push(`${field} is required for a ${profile}; write the value, or "MISSING: <why>" if nobody has it yet`);
      return false;
    }
    return true;
  };

  collectGaps(d, "", gaps, errors);
  for (const gap of gaps) gap.field = gap.field.replace(/^\./, "");

  // Identity.
  const root = PROFILE_ROOTS[profile];
  if (required("path")) {
    if (typeof d.path !== "string" || d.path !== `${root}${expect.slug}`) {
      errors.push(`path is ${JSON.stringify(d.path)}; a ${profile} named ${expect.slug}.md lives at ${root}${expect.slug}`);
    }
  }
  for (const field of ["title", "seo_title", "description"]) {
    if (required(field) && !nonEmptyString(d[field])) errors.push(`${field} must be text`);
  }
  if (typeof d.seo_title === "string" && d.seo_title.length > SEO_TITLE_MAX) {
    errors.push(`seo_title is ${d.seo_title.length} characters; Google clips near ${SEO_TITLE_MAX}`);
  }
  if (typeof d.description === "string" && d.description.length > DESCRIPTION_MAX) {
    errors.push(`description is ${d.description.length} characters; Google clips near ${DESCRIPTION_MAX}`);
  }
  if (d.draft !== undefined && typeof d.draft !== "boolean") errors.push("draft must be true or false");

  // The shared core.
  required("version");
  if (required("updated") && !isGap(d.updated) && !/^\d{4}-\d{2}-\d{2}$/.test(String(d.updated))) {
    errors.push(`updated is ${JSON.stringify(d.updated)}; write the date as YYYY-MM-DD`);
  }
  if (required("based_on") && !isGap(d.based_on)) {
    if (!Array.isArray(d.based_on)) errors.push("based_on must be a list of sources");
    else {
      d.based_on.forEach((/** @type {any} */ s, /** @type {number} */ i) => {
        if (!s || typeof s !== "object" || !nonEmptyString(s.citation)) errors.push(`based_on[${i}] needs a citation`);
        else if (!nonEmptyString(s.for)) errors.push(`based_on[${s.citation}] needs a "for": what it is the source of`);
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
    else for (const k of Object.keys(d.time)) if (!["total", "hands_on"].includes(k)) errors.push(`time.${k} is not a time field`);
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
  if (d.equipment !== undefined && !Array.isArray(d.equipment)) errors.push("equipment must be a list");
  const equipmentNames = new Set(
    (Array.isArray(d.equipment) ? d.equipment : []).map((/** @type {any} */ e) =>
      String(typeof e === "string" ? e : e?.name ?? "").toLowerCase(),
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
        if (!/^[a-z0-9-]+$/.test(String(row.id ?? ""))) errors.push(`${at} needs an id in lowercase-with-hyphens`);
        if (troubleIds.has(row.id)) errors.push(`${at}: the id is used twice`);
        troubleIds.add(row.id);
        for (const col of ["step", "problem", "reason", "solution"]) {
          if (!nonEmptyString(row[col])) errors.push(`${at} needs ${col}: the table's columns are step, problem, possible reason, solution`);
        }
        for (const k of Object.keys(row)) {
          if (!["id", "step", "problem", "reason", "solution"].includes(k)) errors.push(`${at}.${k} is not a column`);
        }
      });
    }
  }

  // The method.
  const steps = allSteps(parsed);
  if (steps.length === 0) errors.push("the procedure has no steps: a method section holds a numbered list");
  let previous = 0;
  for (const section of parsed.sections) {
    for (const block of section.blocks) {
      if (block.type !== "steps") continue;
      const first = block.steps[0];
      if (first && first.number !== 1 && first.number !== previous + 1) {
        errors.push(`line ${first.line}: step ${first.number} neither restarts at 1 nor follows step ${previous}`);
      }
      block.steps.forEach((step, i) => {
        if (i > 0 && step.number !== (block.steps[i - 1]?.number ?? 0) + 1) {
          errors.push(`line ${step.line}: step ${step.number} follows step ${block.steps[i - 1]?.number}`);
        }
      });
      previous = block.steps[block.steps.length - 1]?.number ?? previous;
    }
  }

  for (const step of steps) {
    const at = `line ${step.line}, step ${step.number}`;
    if (!step.source.trim()) errors.push(`${at} has no words`);
    for (const reason of step.flags.critical) if (!reason) errors.push(`${at}: CRITICAL needs its reason`);
    for (const kind of /** @type {const} */ (["pause", "why", "expect"])) {
      for (const text of step.flags[kind]) if (!text) errors.push(`${at}: an empty ${kind.toUpperCase()} flag`);
    }
    for (const id of step.flags.troubleshooting) {
      if (!troubleIds.has(id)) errors.push(`${at}: TROUBLESHOOTING names "${id}", which is not a row id in troubleshooting`);
    }
    for (const seg of step.segments) {
      if (seg.type === "material") {
        const declared = materials.get(seg.name.toLowerCase());
        if (!declared && profile !== "recipe") {
          errors.push(`${at}: @${seg.name} is not in materials; declare it there with its stock and amount`);
        }
        if (seg.quantity && profile === "protocol" && !PROTOCOL_QUANTITY.test(`${seg.quantity.amount} ${seg.quantity.unit}`.trim())) {
          errors.push(`${at}: @${seg.name}'s amount "${seg.quantity.raw}" is not a number and a unit from the closed list (${PROTOCOL_UNITS.join(", ")})`);
        }
      }
      if (seg.type === "equipment" && profile !== "recipe" && !equipmentNames.has(seg.name.toLowerCase())) {
        errors.push(`${at}: #${seg.name} is not in equipment`);
      }
      if (seg.type === "timer") {
        if (!seg.quantity || seg.quantity.min === null || !TIME_UNITS.includes(seg.quantity.unit)) {
          errors.push(`${at}: the timer ~{${seg.quantity?.raw ?? ""}} needs a number and a unit of time (${TIME_UNITS.join(", ")})`);
        }
      }
    }
    if (profile === "protocol") {
      const { spins } = stepConditions(step);
      const words = step.segments.map((s) => (s.type === "text" ? s.value : "")).join("");
      const spinsHere = /\bspin\b|\bspun\b|\bcentrifuge\b/i.test(words.replace(/pulse[- ]spin/gi, ""));
      const hasG = spins.some((s) => s.unit === "x g");
      if (spinsHere && !hasG && step.flags.spin.length === 0) {
        errors.push(`${at} spins with no g-force: add "> SPIN: <n> x g", or "> SPIN: MISSING: <why>" (a speed in rpm needs the rotor)`);
      }
      for (const spin of step.flags.spin) {
        if (isGap(spin)) gaps.push({ field: `step ${step.number} (line ${step.line}).spin`, reason: spin.replace(/^MISSING:\s*/, "") });
        else if (!/x g\b/.test(spin)) errors.push(`${at}: SPIN "${spin}" is not in x g`);
      }
    } else if (step.flags.spin.length > 0) {
      errors.push(`${at}: SPIN belongs to the protocol profile`);
    }
    if (profile === "computational") {
      for (const cmd of step.commands) {
        if (cmd.output === null && step.flags.expect.length === 0) {
          errors.push(`${at}: a command needs its expected output: a \`\`\`output block after it, or an EXPECT flag`);
        }
      }
    } else if (step.commands.length > 0 && profile === "recipe") {
      errors.push(`${at}: a recipe step carries no commands`);
    }
    if (step.photos.length > 0 && profile !== "recipe") errors.push(`${at}: step photos belong to the recipe profile`);
    for (const photo of step.photos) if (!photo.alt.trim()) errors.push(`${at}: a step photo needs its alt text`);
  }

  // The profiles.
  if (profile === "protocol") protocolRules(d, errors, required, materials, bodyText(parsed));
  if (profile === "recipe") recipeRules(d, errors, required);
  if (profile === "computational") computationalRules(d, errors, required, materials);

  return { errors, gaps };
}

/**
 * @param {Record<string, any>} d
 * @param {string[]} errors
 * @param {(field: string) => boolean} required
 * @param {Map<string, any>} materials
 * @param {string} body the page's words, which print the primer tables
 */
function protocolRules(d, errors, required, materials, body) {
  for (const field of ["host_strain", "status", "last_run", "biosafety", "scale"]) required(field);
  if (d.biosafety && !isGap(d.biosafety) && d.biosafety !== NOT_APPLICABLE) {
    if (typeof d.biosafety !== "object" || !nonEmptyString(d.biosafety.organism)) {
      errors.push('biosafety lists the agent only: { organism, strain, atcc }, or "not applicable"');
    } else {
      for (const k of Object.keys(d.biosafety)) {
        if (!["organism", "strain", "atcc"].includes(k)) errors.push(`biosafety.${k}: protocols.md lists the agent only (organism, strain, ATCC number)`);
      }
    }
  }
  if (BIOSAFETY_BANNED.test(JSON.stringify(d.biosafety ?? ""))) {
    errors.push("biosafety names a biosafety level, an IBC or the NIH Guidelines; protocols.md lists the agent only");
  }
  if (d.scale && !isGap(d.scale)) {
    if (typeof d.scale !== "object" || !(Number(d.scale.count) > 0) || !nonEmptyString(d.scale.unit)) {
      errors.push("scale needs a count and a unit, such as { count: 5, unit: tube }");
    }
  }
  const solutionIds = new Set();
  if (d.solutions !== undefined) {
    if (!Array.isArray(d.solutions)) errors.push("solutions must be a list");
    else {
      for (const s of d.solutions) {
        const at = `solutions[${s?.id ?? "?"}]`;
        if (!s || !/^[a-z0-9-]+$/.test(String(s.id ?? ""))) errors.push(`${at} needs an id in lowercase-with-hyphens`);
        solutionIds.add(s?.id);
        if (!nonEmptyString(s?.name)) errors.push(`${at} needs a name`);
        if (!Array.isArray(s?.components) || s.components.length === 0) errors.push(`${at} needs its components`);
        for (const field of ["storage", "shelf_life"]) {
          if (!nonEmptyString(s?.[field])) errors.push(`${at} needs ${field}, or "MISSING: <why>"`);
        }
        for (const c of Array.isArray(s?.components) ? s.components : []) {
          if (!nonEmptyString(c?.name)) errors.push(`${at} has a component with no name`);
          for (const q of ["final", "amount"]) {
            if (c?.[q] !== undefined && !isGap(c[q]) && !PROTOCOL_QUANTITY.test(String(c[q]))) {
              errors.push(`${at}.${c.name}.${q} is "${c[q]}", not a number and a unit from the closed list`);
            }
          }
        }
      }
    }
  }
  for (const m of materials.values()) {
    const at = `materials[${m.name}]`;
    for (const key of ["amount", "final", "per"]) {
      const q = m[key];
      if (q === undefined || isGap(q)) continue;
      if (key === "per" && typeof q === "string" && !/^\d/.test(q)) continue;
      if (typeof q !== "string" || !PROTOCOL_QUANTITY.test(q)) {
        errors.push(`${at}.${key} is "${String(q)}", not a number and a unit from the closed list (${PROTOCOL_UNITS.join(", ")})`);
      }
    }
    if (m.stock !== undefined) {
      const stocks = Array.isArray(m.stock) ? m.stock : [m.stock];
      for (const s of stocks) {
        if (!isGap(s) && !PROTOCOL_QUANTITY.test(String(s))) errors.push(`${at}.stock "${s}" is not a number and a unit from the closed list`);
      }
    }
    if (m.solution !== undefined && !solutionIds.has(m.solution)) errors.push(`${at}.solution names "${m.solution}", which is not in solutions`);
  }
  if (d.primers !== undefined && d.primers !== NOT_APPLICABLE && !isGap(d.primers)) {
    if (!Array.isArray(d.primers)) errors.push(`primers must be a list, or "${NOT_APPLICABLE}"`);
    else {
      for (const p of d.primers) {
        const at = `primers[${p?.set ? `${p.set} ` : ""}${p?.direction ?? "?"}]`;
        if (!["forward", "reverse", "probe"].includes(p?.direction)) errors.push(`${at} needs a direction: forward, reverse or probe`);
        if (!isGap(p?.sequence) && !IUPAC.test(String(p?.sequence ?? ""))) errors.push(`${at}.sequence is not an upper-case IUPAC nucleotide sequence`);
        // The page prints its primer tables in the text; the record and the table must not drift apart.
        else if (!isGap(p?.sequence) && !body.includes(String(p.sequence))) errors.push(`${at}.sequence ${p.sequence} is not printed anywhere on the page`);
      }
    }
  }
  if (d.cycling !== undefined) {
    if (!Array.isArray(d.cycling)) errors.push("cycling must be a list of programs");
    else {
      const walk = (/** @type {any} */ stage, /** @type {string} */ at) => {
        if (Array.isArray(stage?.steps)) stage.steps.forEach((/** @type {any} */ s, /** @type {number} */ i) => walk(s, `${at}.steps[${i}]`));
        if (typeof stage?.temperature_c === "string" && /^\d+ to \d+$/.test(stage.temperature_c) && stage.touchdown_step_c === undefined) {
          errors.push(`${at} is a touchdown (${stage.temperature_c} °C) with no touchdown_step_c; write it, or "MISSING: <why>"`);
        }
      };
      d.cycling.forEach((/** @type {any} */ program, /** @type {number} */ i) => {
        const at = `cycling[${program?.set ?? i}]`;
        if (!Array.isArray(program?.program)) errors.push(`${at} needs its program: a list of stages`);
        else program.program.forEach((/** @type {any} */ stage, /** @type {number} */ j) => walk(stage, `${at}.program[${stage?.stage ?? j}]`));
      });
    }
  }
}

/**
 * @param {Record<string, any>} d
 * @param {string[]} errors
 * @param {(field: string) => boolean} required
 */
function recipeRules(d, errors, required) {
  for (const field of ["servings", "cuisine", "category", "prep_time", "cook_time", "image"]) required(field);
  if (d.servings !== undefined && !isGap(d.servings) && !(Number(d.servings) > 0)) errors.push("servings must be a number");
  for (const field of ["prep_time", "cook_time"]) {
    if (d[field] !== undefined && !isGap(d[field]) && !/^\d+(?:\.\d+)? (minutes?|hours?)$/.test(String(d[field]))) {
      errors.push(`${field} is "${d[field]}"; write it as "20 minutes" or "1.5 hours"`);
    }
  }
  if (d.image !== undefined && !isGap(d.image) && (!nonEmptyString(d.image?.src) || !nonEmptyString(d.image?.alt))) {
    errors.push("image needs src and alt");
  }
  if (d.substitutions !== undefined) {
    if (!Array.isArray(d.substitutions)) errors.push("substitutions must be a list");
    else for (const s of d.substitutions) if (!nonEmptyString(s?.for) || !nonEmptyString(s?.use)) errors.push("each substitution needs for and use");
  }
  if (d.scale !== undefined) errors.push("a recipe scales by servings, not scale");
}

/**
 * @param {Record<string, any>} d
 * @param {string[]} errors
 * @param {(field: string) => boolean} required
 * @param {Map<string, any>} materials
 */
function computationalRules(d, errors, required, materials) {
  required("environment");
  if (required("prerequisites") && !isGap(d.prerequisites) && !Array.isArray(d.prerequisites)) {
    errors.push("prerequisites must be a list");
  }
  if (d.scale !== undefined || d.servings !== undefined) errors.push("a computational procedure does not scale");
  for (const m of materials.values()) {
    if (!["software", "data", "file"].includes(m.kind)) errors.push(`materials[${m.name}].kind must be software, data or file`);
    if (m.kind === "software" && !nonEmptyString(m.version)) errors.push(`materials[${m.name}] is software and needs its version`);
  }
}
