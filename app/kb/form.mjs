// The Knowledge Base's form editor, the part that needs no runtime (docs/KNOWLEDGE-BASE.md): a file read into a form's
// model, and a form's model written back into the file. The file stays the source (hard rule 18), so what the form
// writes goes through the same save and the same checks as the raw editor. What the form did not touch is written back
// byte for byte: a front-matter field whose value is unchanged keeps the text it was written in, and a step keeps its
// lines, so a save from the form changes only what was changed. formToFile(fileToForm(raw)) === raw for every file.

import matter from "gray-matter";

/** YAML through gray-matter, the reader every content file is parsed with, so the form reads a field as the compile does. */
const yaml = {
  /** @param {string} text */
  load: (text) => /** @type {Record<string, unknown>} */ (matter(`---\n${text}\n---\n`).data),
  /** @param {Record<string, unknown>} value */
  dump: (value) => matter.stringify("", value).replace(/^---\n/, "").replace(/\n---\n*$/, "\n"),
};

/**
 * @typedef {{ kind: string, text: string, indent: string } | { raw: string }} StepLine
 * @typedef {{ number: number, text: string, lines: StepLine[], blanksBefore: number }} FormStep
 * @typedef {{ type: "prose", text: string } | { type: "steps", start: number, steps: FormStep[] }} FormBlock
 * @typedef {{ heading: string, blocks: FormBlock[] }} FormSection
 * @typedef {{ intro: string, sections: FormSection[] }} FormBody
 * @typedef {{ data: Record<string, unknown>, order: string[], body: FormBody | null }} FormModel
 */

/** The step flags the procedure format has (docs/PROCEDURES.md), in the order the form offers them. */
export const STEP_FLAGS = /** @type {const} */ (["CRITICAL", "PAUSE POINT", "WHY", "EXPECT", "SPIN", "TROUBLESHOOTING", "CALC"]);

const FRONT = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/;
const KEY = /^([A-Za-z_][\w-]*):(?:\s|$)/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Dates as the ISO day the file wrote, so a form and JSON carry the same value YAML read. @param {unknown} value @returns {unknown} */
function plain(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  return value;
}

/** Equal as data, whatever order an object's keys came in. @param {unknown} a @param {unknown} b @returns {boolean} */
export function sameValue(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => sameValue(/** @type {any} */ (a)[k], /** @type {any} */ (b)[k]));
  }
  return a === b;
}

/**
 * The file's front matter, split into each top-level field's own text. Lines before the first field (a comment) are
 * kept as the prelude.
 *
 * @param {string} raw
 */
export function splitFile(raw) {
  const match = FRONT.exec(raw);
  if (!match) throw new Error("the file does not start with front matter between --- lines");
  const lines = (match[1] ?? "").split(/\r?\n/);
  /** @type {string[]} */
  const prelude = [];
  /** @type {Array<{ key: string, text: string }>} */
  const fields = [];
  for (const line of lines) {
    const key = KEY.exec(line);
    if (key) fields.push({ key: /** @type {string} */ (key[1]), text: line });
    else if (fields.length > 0) /** @type {{ text: string }} */ (fields[fields.length - 1]).text += `\n${line}`;
    else prelude.push(line);
  }
  return { prelude, fields, after: match[2] ?? "\n", body: raw.slice(match[0].length) };
}

/** One field's value, read from its own text. @param {string} text */
function readField(text) {
  const parsed = yaml.load(text);
  return parsed && typeof parsed === "object" ? plain(Object.values(parsed)[0]) : undefined;
}

/** A plain one-line string YAML reads back as itself, unquoted. @param {string} value */
function bare(value) {
  if (value === "" || value !== value.trim() || /[\n:#]|^[-?[\]{},&*!|>'"%@`]/.test(value)) return false;
  try {
    return yaml.load(`v: ${value}`)["v"] === value;
  } catch {
    return false;
  }
}

/** A field written fresh, for a value the form changed. @param {string} key @param {unknown} value */
function writeField(key, value) {
  if (typeof value === "string") {
    if (DAY.test(value) || bare(value)) return `${key}: ${value}`;
    return `${key}: ${JSON.stringify(value)}`;
  }
  if (typeof value === "number" || typeof value === "boolean") return `${key}: ${value}`;
  return yaml.dump({ [key]: value }).replace(/\n$/, "");
}

/**
 * A step list's own lines: a numbered item, then its indented lines (flags, commands, wrapped words), with the blank
 * lines inside the list kept where they were.
 *
 * @param {string[]} lines
 * @param {number} i the index of the item line
 */
function readStep(lines, i) {
  const item = /^(\d+)\.\s+(.*)$/.exec(lines[i] ?? "");
  /** @type {StepLine[]} */
  const stepLines = [];
  let j = i + 1;
  while (j < lines.length) {
    const next = lines[j] ?? "";
    if (/^\s{2,}\S/.test(next)) {
      const flag = /^(\s+)>\s*(CRITICAL|PAUSE POINT|WHY|TROUBLESHOOTING|EXPECT|SPIN|CALC)\s*:\s?(.*)$/.exec(next);
      // A flag is the form's to edit when its line is exactly what the form would write back.
      if (flag && next === `${flag[1]}> ${flag[2]}: ${flag[3]}`) stepLines.push({ kind: /** @type {string} */ (flag[2]), text: flag[3] ?? "", indent: flag[1] ?? "   " });
      else stepLines.push({ raw: next });
      j += 1;
    } else if (next.trim() === "" && /^\s{2,}\S/.test(lines[j + 1] ?? "")) {
      stepLines.push({ raw: next });
      j += 1;
    } else break;
  }
  return { step: { number: Number(item?.[1]), text: item?.[2] ?? "", lines: stepLines, blanksBefore: 0 }, next: j };
}

/** A section's lines as blocks: step lists, and everything else as prose kept line for line. @param {string[]} lines */
function readBlocks(lines) {
  /** @type {FormBlock[]} */
  const blocks = [];
  /** @type {string[]} */
  let prose = [];
  let inFence = false;
  let i = 0;
  const flush = () => {
    if (prose.length > 0) blocks.push({ type: "prose", text: prose.join("\n") });
    prose = [];
  };
  while (i < lines.length) {
    const text = lines[i] ?? "";
    if (text.startsWith("```")) inFence = !inFence;
    if (!inFence && /^\d+\.\s/.test(text)) {
      flush();
      /** @type {FormStep[]} */
      const steps = [];
      let blanks = 0;
      while (i < lines.length && /^\d+\.\s/.test(lines[i] ?? "")) {
        const { step, next } = readStep(lines, i);
        steps.push({ ...step, blanksBefore: blanks });
        i = next;
        // Blank lines between two items keep the list going; any other line ends it.
        blanks = 0;
        let k = i;
        while (k < lines.length && (lines[k] ?? "").trim() === "") k += 1;
        if (k > i && /^\d+\.\s/.test(lines[k] ?? "")) {
          blanks = k - i;
          i = k;
        }
      }
      blocks.push({ type: "steps", start: steps[0]?.number ?? 1, steps });
      continue;
    }
    prose.push(text);
    i += 1;
  }
  flush();
  return blocks;
}

/**
 * A procedure's body as the form shows it: the intro, then each `## ` section with its prose and its steps.
 *
 * @param {string} body
 * @returns {FormBody}
 */
export function readBody(body) {
  const lines = body.split("\n");
  /** @type {string[]} */
  const intro = [];
  /** @type {Array<{ heading: string, lines: string[] }>} */
  const raw = [];
  let inFence = false;
  for (const line of lines) {
    if (line.startsWith("```")) inFence = !inFence;
    if (!inFence && line.startsWith("## ")) raw.push({ heading: line.slice(3), lines: [] });
    else if (raw.length > 0) /** @type {{ lines: string[] }} */ (raw[raw.length - 1]).lines.push(line);
    else intro.push(line);
  }
  return { intro: intro.join("\n"), sections: raw.map((s) => ({ heading: s.heading, blocks: readBlocks(s.lines) })) };
}

/** A step's lines, numbered. @param {FormStep} step @param {number} number */
function writeStep(step, number) {
  const lines = [`${number}. ${step.text}`];
  for (const line of step.lines) {
    if ("raw" in line) lines.push(line.raw);
    else lines.push(`${line.indent || "   "}> ${line.kind}: ${line.text}`);
  }
  return [...Array(step.blanksBefore).fill(""), ...lines].join("\n");
}

/** The body the form describes. A step list is numbered from where it started, in the order the form put it. @param {FormBody} body */
export function writeBody(body) {
  const parts = [body.intro];
  for (const section of body.sections) {
    const lines = [`## ${section.heading}`];
    for (const block of section.blocks) {
      if (block.type === "prose") lines.push(block.text);
      else lines.push(block.steps.map((step, i) => writeStep(step, block.start + i)).join("\n"));
    }
    parts.push(lines.join("\n"));
  }
  return parts.join("\n");
}

/**
 * A file as a form's model: every front-matter field's value, in the file's order, and for a procedure its body.
 *
 * @param {string} raw
 * @param {{ body?: boolean }} [options] body: false for a registry item, whose file is its front matter alone
 * @returns {FormModel}
 */
export function fileToForm(raw, options = {}) {
  const { fields, body } = splitFile(raw);
  /** @type {Record<string, unknown>} */
  const data = {};
  for (const field of fields) data[field.key] = readField(field.text);
  return { data, order: fields.map((f) => f.key), body: options.body === false ? null : readBody(body) };
}

/**
 * The file a form's model describes, written over the file it was read from: an unchanged field keeps its text, a
 * changed one is written fresh, a new one goes after the rest, and a field the form removed (undefined) is left out.
 *
 * @param {string} original
 * @param {FormModel} model
 */
export function formToFile(original, model) {
  const { prelude, fields, after, body } = splitFile(original);
  const known = new Map(fields.map((f) => [f.key, f.text]));
  const keys = [...model.order.filter((k) => known.has(k) || k in model.data), ...Object.keys(model.data).filter((k) => !model.order.includes(k))];
  /** @type {string[]} */
  const out = [...prelude];
  for (const key of new Set(keys)) {
    const value = model.data[key];
    if (value === undefined) continue;
    const text = known.get(key);
    out.push(text !== undefined && sameValue(readField(text), value) ? text : writeField(key, value));
  }
  return `---\n${out.join("\n")}\n---${after}${model.body ? writeBody(model.body) : body}`;
}
