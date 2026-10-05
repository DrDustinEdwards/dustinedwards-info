// Judges a parsed procedure against its profile (docs/PROCEDURES.md). check:protocols and the operator
// API's save_procedure both call validateProcedure, so a file CI refuses is a file the save tool refuses,
// for the same reason in the same words.
//
// A value nobody has yet is written "MISSING: <why>" in place. It passes and is returned as a gap, so
// the check can print it and the read tool can show it. A bare MISSING, or a required field left out,
// is an error: a forgotten field cannot pass as a recorded gap.

import { DOI_PATTERN, VERSION_PATTERN } from "./cite.mjs";
import { allSteps, readCalcs, stepConditions } from "./parse.mjs";
import { proofErrors } from "./proof.mjs";
import { COURSES, METHODS, ORGANISMS } from "./taxonomy.mjs";
import { TOOLS } from "../phage-tools.mjs";

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

/** The levels a protocol's `biosafety_level` may name (protocols.md, amended 2026-10-04); each is Dustin's to set. */
export const BIOSAFETY_LEVELS = ["BSL-1", "BSL-2"];

/** Words protocols.md keeps off a protocol's `biosafety` note: the agent only. The separate `biosafety_level` field holds the level. */
const BIOSAFETY_BANNED = /\b(BSL|biosafety level|IBC|NIH)\b/i;

/** A primer's id in the lab registry (app/lib/registry/compile.mjs ID_PATTERN): a protocol names primers by it and stores no sequence. */
const PRIMER_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;

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
    for (const [k, v] of Object.entries(value)) collectGaps(v, path ? `${path}.${k}` : k, gaps, errors);
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
 * @param {unknown} value
 */
function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * The version history, newest first: each version with its date, what changed and, once Zenodo has minted
 * one, its DOI. The first entry is the version the page is at, so the version is stored once in `version`
 * and the history cannot disagree with it.
 *
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
    for (const k of Object.keys(h)) if (!["version", "date", "summary", "doi"].includes(k)) errors.push(`${at}.${k} is not a history field (version, date, summary, doi)`);
    if (!VERSION_PATTERN.test(String(h.version ?? ""))) errors.push(`${at} needs a version of letters, digits, dots, hyphens and underscores`);
    if (seen.has(String(h.version))) errors.push(`${at}: the version is listed twice`);
    seen.add(String(h.version));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(h.date ?? ""))) errors.push(`${at}.date is ${JSON.stringify(h.date)}; write the date as YYYY-MM-DD`);
    else if (String(h.date) > newer) errors.push(`${at}.date ${h.date} is later than the entry above it; the history is newest first`);
    else newer = String(h.date);
    if (!nonEmptyString(h.summary)) errors.push(`${at} needs a summary of what changed`);
    if (h.doi !== undefined && !DOI_PATTERN.test(String(h.doi))) errors.push(`${at}.doi is ${JSON.stringify(h.doi)}; write the DOI as 10.xxxx/suffix, without the https://doi.org/ address`);
  });
  if (d.version === undefined || d.version === null || isGap(d.version)) {
    errors.push("history needs a version: the first entry is the version the page is at, so set version to it");
  } else if (String(d.history[0]?.version) !== String(d.version)) {
    errors.push(`version is ${JSON.stringify(d.version)} but the first history entry is ${JSON.stringify(String(d.history[0]?.version))}; the newest entry is the current version`);
  }
}

/**
 * Checks one parsed procedure.
 *
 * @param {import("./parse.mjs").ParsedProcedure} parsed
 * @param {{ slug: string, primers?: ReadonlySet<string> | null }} expect the slug its file name gives, and the ids of the primers
 *   the lab registry holds (null or absent when the registry is not at hand, which `compileProcedure` refuses for a protocol that lists primers)
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

  // What the library filters by. method, organism and course are ids from the closed lists in taxonomy.mjs; target
  // is the gene, region or sample, in words. Every procedure is some method, so method is required.
  for (const [field, vocabulary] of /** @type {const} */ ([["method", METHODS], ["organism", ORGANISMS], ["course", COURSES]])) {
    if (field === "method") required(field);
    const value = d[field];
    if (value === undefined || isGap(value)) continue;
    const allowed = Object.keys(vocabulary);
    if (!Array.isArray(value)) errors.push(`${field} must be a list of ids from: ${allowed.join(", ")}`);
    else {
      for (const id of value) if (!allowed.includes(id)) errors.push(`${field} "${id}" is not one of: ${allowed.join(", ")} (taxonomy.mjs)`);
      if (new Set(value).size !== value.length) errors.push(`${field} names one id twice`);
    }
  }
  if (d.target !== undefined && !isGap(d.target)) {
    if (!Array.isArray(d.target) || d.target.some((t) => !nonEmptyString(t))) errors.push("target must be a list of the genes, regions or samples it works on, each in words");
  }

  // Where it stands in the library's "Start here" list: a position (1, 2, ...), stored, never inferred. A position
  // two procedures share would make the order a guess, so the corpus check refuses it (checkStartHere).
  if (d.start_here !== undefined && !isGap(d.start_here)) {
    if (!Number.isInteger(d.start_here) || d.start_here < 1) errors.push("start_here must be a position in the Start here list: 1, 2, 3 ...");
  }

  // Proof of use: the papers that used the method and the phages it produced, as slugs. Stated, never inferred.
  if (!isGap(d.proof_of_use)) errors.push(...proofErrors(d.proof_of_use));

  // The shared core.
  if (required("version") && !isGap(d.version) && !VERSION_PATTERN.test(String(d.version))) {
    errors.push(`version is ${JSON.stringify(d.version)}; it sits in a URL, so use letters, digits, dots, hyphens and underscores, such as "2" or "1.1"`);
  }
  validateHistory(d, errors);
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
    if (step.flags.calc.length > 0 && profile !== "protocol") errors.push(`${at}: CALC belongs to the protocol profile`);
    const calcs = readCalcs(step.flags.calc);
    if (new Set(calcs.map((c) => c.id)).size !== calcs.length) errors.push(`${at}: CALC names a calculator twice`);
    for (const { id, values } of calcs) {
      const tool = Object.hasOwn(TOOLS, id) ? TOOLS[id] : undefined;
      if (!tool) {
        errors.push(id ? `${at}: CALC names "${id}", which is not a calculator (${Object.keys(TOOLS).join(", ")})` : `${at}: CALC gives a value before it names a calculator`);
        continue;
      }
      for (const [name, value] of Object.entries(values)) {
        if (!tool.fields.some((f) => f.name === name)) errors.push(`${at}: CALC ${id} has no field "${name}" (${tool.fields.map((f) => f.name).join(", ")})`);
        // Every value is the step's own: a number that is not in the step's words is not from the record.
        else if (!step.source.includes(value)) errors.push(`${at}: CALC ${id} ${name}=${value}, but the step does not state ${value}; a value is filled in only from the step's own words`);
      }
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
  if (profile === "protocol") protocolRules(d, errors, required, materials, expect.primers ?? null);
  if (profile === "recipe") recipeRules(d, errors, required);
  if (profile === "computational") computationalRules(d, errors, required, materials);

  return { errors, gaps };
}

/**
 * @param {Record<string, any>} d
 * @param {string[]} errors
 * @param {(field: string) => boolean} required
 * @param {Map<string, any>} materials
 * @param {ReadonlySet<string> | null} primerIds the primers the lab registry holds
 */
function protocolRules(d, errors, required, materials, primerIds) {
  for (const field of ["host_strain", "status", "last_run", "biosafety", "biosafety_level", "scale"]) required(field);
  if (d.biosafety_level !== undefined && !isGap(d.biosafety_level) && !BIOSAFETY_LEVELS.includes(d.biosafety_level)) {
    errors.push(`biosafety_level is ${JSON.stringify(d.biosafety_level)}; it is one of ${BIOSAFETY_LEVELS.join(", ")}, or "MISSING: <why>" until Dustin sets it`);
  }
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
      /** @type {Set<string>} */
      const seen = new Set();
      for (const p of d.primers) {
        const id = p?.primer;
        const at = `primers[${typeof id === "string" ? id : "?"}]`;
        if (typeof id !== "string" || !PRIMER_ID.test(id)) {
          errors.push(`${at} is { primer: <id> }: the id of a primer in the lab registry (content/registry/primer/), such as lco1490. A protocol names its primers and stores no sequence`);
        } else if (seen.has(id)) {
          errors.push(`${at} is listed twice`);
        } else {
          seen.add(id);
          if (primerIds && !primerIds.has(id)) errors.push(`${at} names no primer in the lab registry (there is no content/registry/primer/${id}.md)`);
        }
        for (const key of Object.keys(p ?? {})) {
          if (key !== "primer") errors.push(`${at}.${key} is not a protocol field: a primer's sequence, direction and set are stored once, in the lab registry`);
        }
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
