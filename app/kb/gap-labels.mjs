// A recorded gap said in plain words, with where it is filled in (docs/KNOWLEDGE-BASE.md): "TES buffer: storage",
// "Step 4: rotor", "Biosafety level", never the path the validator records it under. The words below the top-level field
// come from the compile (validate.mjs, `where`), so the admin's list and the editor say the same thing.

import { fieldLabel, keyWords } from "./form-fields.mjs";

/** What a step flag's gap is missing, in words. */
const STEP_WORDS = /** @type {Record<string, string>} */ ({ spin: "rotor" });

const STEP_GAP = /^step (\d+) \(line \d+\)\.(\w+)$/;

/** An input's id from a field key, the id the form gives the field's input. @param {string} key */
export const fieldAnchor = (key) => `kb-field-${key.replace(/[^a-z0-9_-]/gi, "-")}`;

/** A cell's id in a list the form edits as rows (materials): the list, the row's name, the column. */
export const cellAnchor = (/** @type {string} */ key, /** @type {string} */ name, /** @type {string} */ column) =>
  `${fieldAnchor(key)}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${column}`;

/** The lists the form edits as rows, so a gap in a row lands on its cell. */
const ROW_LISTS = new Set(["materials"]);

/**
 * A step card's id, from its section's heading and its number, so a gap in a step lands on its card. A heading's own
 * `{#id}` is left out, as the page leaves it out.
 *
 * @param {string} section
 * @param {number} number
 */
export function stepAnchor(section, number) {
  const words = section.replace(/\s+\{#[a-z0-9-]+\}\s*$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `kb-step-${words || "section"}-${number}`;
}

/** A heading's first words, before its colon: "Part A" for "Part A: collect the phage". @param {string} heading */
const shortHeading = (heading) => heading.replace(/\s+\{#[a-z0-9-]+\}\s*$/, "").split(":")[0]?.trim() ?? heading;

/**
 * Each gap with its label and the id of the input it is filled in at. A step's section is named only when two gaps are
 * in steps with the same number.
 *
 * @template {{ field: string, reason: string, where?: string[], section?: string }} G
 * @param {G[]} gaps
 * @param {string | null} profile null for a registry item, whose fields are its kind's
 * @returns {Array<G & { label: string, anchor: string }>}
 */
export function labelGaps(gaps, profile) {
  const stepSections = new Map();
  for (const gap of gaps) {
    const step = STEP_GAP.exec(gap.field);
    if (step) stepSections.set(step[1], new Set([...(stepSections.get(step[1]) ?? []), gap.section ?? ""]));
  }
  return gaps.map((gap) => {
    const step = STEP_GAP.exec(gap.field);
    if (step) {
      const number = step[1] ?? "";
      const section = gap.section ?? "";
      const named = (stepSections.get(number)?.size ?? 0) > 1 && section ? ` (${shortHeading(section)})` : "";
      return { ...gap, label: `Step ${number}${named}: ${STEP_WORDS[step[2] ?? ""] ?? step[2]}`, anchor: stepAnchor(section, Number(number)) };
    }
    const top = /^[^.[]+/.exec(gap.field)?.[0] ?? gap.field;
    const label = profile ? fieldLabel(profile, top) : keyWords(top);
    const where = gap.where ?? [];
    // An item a list names ("TES buffer") says which field it is in; an item known by its place ("20 cycles") does not.
    const first = /^\[([^\]]*)\]/.exec(gap.field.slice(top.length));
    const parts = where.length === 0 ? [label] : first && !/^\d+$/.test(first[1] ?? "") ? where : [label, ...where];
    const last = parts.pop() ?? label;
    const column = /^\[[^\]]*\]\.(\w+)$/.exec(gap.field.slice(top.length))?.[1];
    const anchor = ROW_LISTS.has(top) && first && column ? cellAnchor(top, first[1] ?? "", column) : fieldAnchor(top);
    return { ...gap, label: parts.length > 0 ? `${parts.join(", ")}: ${last}` : last, anchor };
  });
}
