// The protocol record: the structured fields protocols.md (Capsid, dustinedwards) asks every protocol
// to carry, read from the `protocol:` block of each /research/protocols/ page's frontmatter.
//
// A value nobody has yet is written as the marker MISSING, never filled with a guess. A field left
// out entirely counts as missing too, so a forgotten field cannot pass as a recorded gap.

export const MISSING = "MISSING";
export const NOT_APPLICABLE = "not applicable";

/** protocols.md: "steps, reagents with amounts and units, timings, primers, equipment, host strain,
 * source and citation, biosafety note, status, version, last run". */
export const REQUIRED_FIELDS = [
  "steps",
  "reagents",
  "timings",
  "primers",
  "equipment",
  "host_strain",
  "source",
  "biosafety",
  "status",
  "version",
  "last_run",
];

/** A field a protocol can truly lack: a phage plating uses no primers, a PCR on bird DNA no host. */
export const MAY_NOT_APPLY = new Set(["primers", "host_strain"]);

/** protocols.md: "units are a closed list". A unit outside it fails until it is added here on purpose. */
export const UNITS = ["µl", "µL", "ml", "mL", "M", "mM", "µM", "nM", "mg/ml", "%", "U", "volume", "volumes"];

const NUMBER = String.raw`\d[\d,]*(?:\.\d+)?`;
const UNIT = UNITS.map((u) => u.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|");
/** "250 µl", "4 mL", "0.5 mL", "1 %", "100% or 80%", "200 to 400 nM". */
const QUANTITY = new RegExp(`^${NUMBER} ?(?:${UNIT})(?: (?:to|or) ${NUMBER} ?(?:${UNIT}))?$`);

/** IUPAC nucleotide codes, upper case, as the pages print them. */
const PRIMER = /^[ACGTRYSWKMBDHVN]+$/;

/** A centrifuge speed in rpm cannot be turned into g without the rotor. */
const RPM = /\brpm\b/;

/** An annealing range such as "60 to 50" is a touchdown and needs its step size. */
const RANGE = /^\d+ to \d+$/;

/**
 * The label a list item is addressed by in a path: its own name where it has one, so a known-missing
 * entry survives a reordering, and its index where it has none.
 *
 * @param {unknown} item
 * @param {number} index
 */
function itemLabel(item, index) {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const o = /** @type {Record<string, unknown>} */ (item);
    const head = ["set", "method"].map((k) => o[k]).filter((v) => typeof v === "string" && v);
    const own = ["name", "stage", "step", "citation"].map((k) => o[k]).find((v) => typeof v === "string" && v);
    const parts = [...head, ...(own ? [own] : [])];
    if (parts.length > 0) return parts.join(" / ");
  }
  return String(index);
}

/**
 * Every MISSING marker under `value`, by path.
 *
 * @param {unknown} value
 * @param {string} path
 * @param {string[]} out
 */
function collectMarkers(value, path, out) {
  if (value === MISSING) {
    out.push(path);
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => collectMarkers(item, `${path}[${itemLabel(item, i)}]`, out));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) collectMarkers(v, `${path}.${k}`, out);
  }
  return out;
}

/**
 * Walks every object in the tree with its path.
 *
 * @param {unknown} value
 * @param {string} path
 * @param {(node: Record<string, unknown>, path: string) => void} visit
 */
function walkObjects(value, path, visit) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => walkObjects(item, `${path}[${itemLabel(item, i)}]`, visit));
  } else if (value && typeof value === "object") {
    visit(/** @type {Record<string, unknown>} */ (value), path);
    for (const [k, v] of Object.entries(value)) walkObjects(v, `${path}.${k}`, visit);
  }
}

/**
 * Reads one protocol record.
 *
 * `missing` is every gap, by path: a required field left out, and every MISSING marker, and every
 * value a rule below needs and the record does not carry (a touchdown with no step size, an rpm spin
 * with no g). `errors` are values that are present and wrong.
 *
 * @param {unknown} record the page's `protocol:` frontmatter
 * @param {{ anchors?: Set<string> }} [page] the heading ids the page renders, to check `steps`
 * @returns {{ missing: string[], errors: string[] }}
 */
export function inspectProtocol(record, page = {}) {
  /** @type {string[]} */
  const missing = [];
  /** @type {string[]} */
  const errors = [];
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return { missing: [...REQUIRED_FIELDS], errors: ["has no protocol: block in its frontmatter"] };
  }
  const r = /** @type {Record<string, unknown>} */ (record);

  for (const key of Object.keys(r)) {
    if (!REQUIRED_FIELDS.includes(key)) errors.push(`carries "${key}", which is not a protocol field`);
  }

  for (const field of REQUIRED_FIELDS) {
    const value = r[field];
    if (value === undefined || value === null || value === "") {
      missing.push(field);
      continue;
    }
    if (value === NOT_APPLICABLE) {
      if (!MAY_NOT_APPLY.has(field)) errors.push(`${field} is "${NOT_APPLICABLE}", which only ${[...MAY_NOT_APPLY].join(" and ")} may be`);
      continue;
    }
    collectMarkers(value, field, missing);

    walkObjects(value, field, (node, path) => {
      if (field === "reagents" || field === "primers") {
        if (typeof node.name !== "string" && typeof node.direction !== "string") {
          errors.push(`${path} has neither a name nor a direction`);
        }
      }
      /* `per` may name a count ("plate") rather than a quantity; it is checked only when it is a number. */
      for (const key of ["amount", "stock", "per"]) {
        const q = node[key];
        if (q === undefined || q === MISSING) continue;
        if (key === "per" && typeof q === "string" && !/^\d/.test(q)) continue;
        if (typeof q !== "string" || !QUANTITY.test(q)) {
          errors.push(`${path}.${key} is "${String(q)}", not a number and a unit from the closed list (${UNITS.join(", ")})`);
        }
      }
      if (field === "reagents" && node.amount === undefined) missing.push(`${path}.amount`);
      if (field === "primers") {
        if (node.sequence === undefined) missing.push(`${path}.sequence`);
        else if (node.sequence !== MISSING && (typeof node.sequence !== "string" || !PRIMER.test(node.sequence))) {
          errors.push(`${path}.sequence is not an upper-case IUPAC nucleotide sequence`);
        }
      }
      if (typeof node.spin === "string" && RPM.test(node.spin) && node.g === undefined) {
        missing.push(`${path}.g`);
      }
      if (typeof node.temperature_c === "string" && RANGE.test(node.temperature_c) && node.touchdown_step_c === undefined) {
        missing.push(`${path}.touchdown_step_c`);
      }
    });
  }

  const steps = r.steps;
  if (Array.isArray(steps)) {
    for (const step of steps) {
      if (typeof step !== "string" || !step.startsWith("#")) {
        errors.push(`steps holds "${String(step)}"; each step is a #heading on the page, so the method has one source`);
      } else if (page.anchors && !page.anchors.has(step.slice(1))) {
        errors.push(`steps points at ${step}, which is not a heading on the page`);
      }
    }
  } else if (steps !== undefined && steps !== MISSING) {
    errors.push("steps is not a list of #headings");
  }

  return { missing: [...new Set(missing)], errors };
}

/**
 * Sets the gaps found against the ones on record as waiting on someone.
 *
 * @param {Map<string, string[]>} found protocol path -> missing field paths
 * @param {Array<{ protocol: string, field: string, reason: string }>} known
 * @returns {{ unrecorded: string[], stale: string[], recorded: Array<{ protocol: string, field: string, reason: string }>, malformed: string[] }}
 */
export function compareKnownMissing(found, known) {
  /** @type {string[]} */
  const malformed = [];
  const keys = new Set();
  for (const entry of known) {
    const key = `${entry?.protocol} ${entry?.field}`;
    if (!entry || typeof entry.protocol !== "string" || typeof entry.field !== "string" || typeof entry.reason !== "string" || !entry.reason.trim()) {
      malformed.push(`${JSON.stringify(entry)}: needs protocol, field and a reason`);
    } else if (keys.has(key)) {
      malformed.push(`${key} is listed twice`);
    }
    keys.add(key);
  }
  /** @type {string[]} */
  const unrecorded = [];
  for (const [protocol, fields] of found) {
    for (const field of fields) if (!keys.has(`${protocol} ${field}`)) unrecorded.push(`${protocol} ${field}`);
  }
  const foundKeys = new Set([...found].flatMap(([p, fs]) => fs.map((f) => `${p} ${f}`)));
  const stale = known.filter((e) => e && !foundKeys.has(`${e.protocol} ${e.field}`)).map((e) => `${e.protocol} ${e.field}`);
  const recorded = known.filter((e) => e && foundKeys.has(`${e.protocol} ${e.field}`));
  return { unrecorded, stale, recorded, malformed };
}
