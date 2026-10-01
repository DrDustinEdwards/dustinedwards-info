// Reads a procedure file (docs/PROCEDURES.md) into its structure: the front matter as written, then the
// body as an intro and sections, each section a run of prose blocks and step lists. Nothing here renders
// or judges; validate.mjs judges and render.mjs renders, so the check and the save tool read one parse.

import { slug as githubSlug } from "github-slugger";
import matter from "gray-matter";

import { readConditions, segmentText, tokenize } from "./marks.mjs";

export const PROCEDURES_DIR = "content/procedures";

/** The repository path of a procedure's file. */
export function procedurePath(/** @type {string} */ slug) {
  return `${PROCEDURES_DIR}/${slug}.md`;
}

/**
 * The heading id rehype-slug gives the same words, by the same library, so an anchor the old pages
 * published keeps working. A repeated heading's -1, -2 suffix is render.mjs's, which slugs the page in
 * one pass as rehype-slug does.
 *
 * @param {string} text
 */
export function headingId(text) {
  return githubSlug(text);
}

const FLAG_KEYS = /** @type {const} */ ({
  CRITICAL: "critical",
  "PAUSE POINT": "pause",
  WHY: "why",
  TROUBLESHOOTING: "troubleshooting",
  EXPECT: "expect",
  SPIN: "spin",
});

/**
 * @typedef {{ critical: string[], pause: string[], why: string[], troubleshooting: string[], expect: string[], spin: string[] }} Flags
 * @typedef {{ lang: string, code: string, output: string | null }} Command
 * @typedef {{
 *   number: number,
 *   line: number,
 *   source: string,
 *   segments: import("./marks.mjs").Segment[],
 *   flags: Flags,
 *   commands: Command[],
 *   photos: Array<{ alt: string, src: string }>,
 * }} Step
 * @typedef {{ type: "prose", markdown: string } | { type: "steps", steps: Step[] }} Block
 * @typedef {{ title: string, id: string, custom: boolean, line: number, blocks: Block[] }} Section
 */

/**
 * YAML dates arrive as Date objects; the record keeps the ISO day the file wrote.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function plain(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  }
  return value;
}

/**
 * The lines under a step, with its indentation removed, split into the step's own words, its flags,
 * its commands and its photos.
 *
 * @param {string} first the text after "N. "
 * @param {string[]} rest the indented lines under it, dedented
 * @param {number} line
 * @param {number} number
 * @returns {{ step: Step, problems: string[] }}
 */
function readStep(first, rest, line, number) {
  /** @type {string[]} */
  const problems = [];
  /** @type {string[]} */
  const words = [first];
  /** @type {Flags} */
  const flags = { critical: [], pause: [], why: [], troubleshooting: [], expect: [], spin: [] };
  /** @type {Command[]} */
  const commands = [];
  /** @type {Array<{ alt: string, src: string }>} */
  const photos = [];
  /** @type {keyof Flags | null} */
  let openFlag = null;

  for (let i = 0; i < rest.length; i += 1) {
    const text = rest[i] ?? "";
    const fence = /^```(\S*)\s*$/.exec(text);
    if (fence) {
      openFlag = null;
      const lang = fence[1] ?? "";
      /** @type {string[]} */
      const code = [];
      i += 1;
      while (i < rest.length && !/^```\s*$/.test(rest[i] ?? "")) {
        code.push(rest[i] ?? "");
        i += 1;
      }
      if (i >= rest.length) problems.push(`line ${line}: step ${number} has a code block that is never closed`);
      if (lang === "output") {
        const target = commands[commands.length - 1];
        if (!target) problems.push(`line ${line}: step ${number} has an output block with no command before it`);
        else target.output = code.join("\n");
      } else {
        commands.push({ lang, code: code.join("\n"), output: null });
      }
      continue;
    }
    const flag = /^>\s*(CRITICAL|PAUSE POINT|WHY|TROUBLESHOOTING|EXPECT|SPIN)\s*:\s*(.*)$/.exec(text);
    if (flag) {
      openFlag = FLAG_KEYS[/** @type {keyof typeof FLAG_KEYS} */ (flag[1])];
      const body = (flag[2] ?? "").trim();
      if (openFlag === "troubleshooting") {
        flags.troubleshooting.push(...body.split(/[,\s]+/).filter(Boolean));
      } else {
        flags[openFlag].push(body);
      }
      continue;
    }
    const more = /^>\s?(.*)$/.exec(text);
    if (more) {
      if (!openFlag || openFlag === "troubleshooting") {
        problems.push(`line ${line}: step ${number} has a quoted line that follows no flag: "${text.trim()}"`);
      } else {
        const list = flags[openFlag];
        list[list.length - 1] = `${list[list.length - 1] ?? ""}\n${more[1] ?? ""}`.replace(/^\n/, "");
      }
      continue;
    }
    openFlag = null;
    const photo = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/.exec(text.trim());
    if (photo) {
      photos.push({ alt: photo[1] ?? "", src: photo[2] ?? "" });
      continue;
    }
    if (text.trim()) words.push(text.trim());
  }

  const source = words.join(" ");
  return {
    step: {
      number,
      line,
      source,
      segments: tokenize(source),
      flags: {
        ...flags,
        critical: flags.critical.map((s) => s.trim()),
        pause: flags.pause.map((s) => s.trim()),
        why: flags.why.map((s) => s.trim()),
        expect: flags.expect.map((s) => s.trim()),
        spin: flags.spin.map((s) => s.trim()),
      },
      commands,
      photos,
    },
    problems,
  };
}

/**
 * A section's lines as blocks: numbered items become steps; everything else at the margin is prose.
 *
 * @param {string[]} lines
 * @param {number} firstLine the file line of lines[0]
 * @returns {{ blocks: Block[], problems: string[] }}
 */
function readBlocks(lines, firstLine) {
  /** @type {Block[]} */
  const blocks = [];
  /** @type {string[]} */
  const problems = [];
  /** @type {string[]} */
  let prose = [];
  /** @type {Step[] | null} */
  let steps = null;
  let inFence = false;

  const flushProse = () => {
    const markdown = prose.join("\n").trim();
    if (markdown) blocks.push({ type: "prose", markdown });
    prose = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i] ?? "";
    if (text.startsWith("```")) inFence = !inFence;
    const item = inFence ? null : /^(\d+)\.\s+(.*)$/.exec(text);
    if (!item) {
      if (steps && (text.trim() === "" || /^\s{2,}/.test(text))) {
        // A blank line inside a list is still the list, unless the margin comes next.
        const next = lines.slice(i + 1).find((l) => l.trim() !== "");
        if (text.trim() === "" && (next === undefined || !/^(\s{2,}|\d+\.\s)/.test(next))) steps = null;
        continue;
      }
      steps = null;
      prose.push(text);
      continue;
    }
    flushProse();
    const start = i;
    /** @type {string[]} */
    const rest = [];
    while (i + 1 < lines.length) {
      const next = lines[i + 1] ?? "";
      if (/^\s{2,}\S/.test(next)) rest.push(next.replace(/^\s{2,4}/, ""));
      else if (next.trim() === "" && /^\s{2,}\S/.test(lines[i + 2] ?? "")) rest.push("");
      else break;
      i += 1;
    }
    const read = readStep(item[2] ?? "", rest, firstLine + start, Number(item[1]));
    problems.push(...read.problems);
    if (!steps) {
      steps = [];
      blocks.push({ type: "steps", steps });
    }
    steps.push(read.step);
  }
  flushProse();
  return { blocks, problems };
}

/**
 * @param {{ file: string, raw: string }} input
 */
export function parseProcedure({ file, raw }) {
  /** @type {string[]} */
  const problems = [];
  let parsed;
  try {
    parsed = matter(raw);
  } catch (error) {
    return {
      file,
      data: /** @type {Record<string, any>} */ ({}),
      intro: "",
      sections: /** @type {Section[]} */ ([]),
      problems: [`the front matter is not valid YAML: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
  const data = /** @type {Record<string, any>} */ (plain(parsed.data));
  const headerLines = raw.slice(0, raw.length - parsed.content.length).split("\n").length - 1;
  const lines = parsed.content.split(/\r?\n/);

  /** @type {Section[]} */
  const sections = [];
  /** @type {string[]} */
  let intro = [];
  let current = /** @type {{ title: string, id: string, custom: boolean, line: number, lines: string[] } | null} */ (null);
  const close = () => {
    if (!current) return;
    const { blocks, problems: found } = readBlocks(current.lines, current.line + 1);
    problems.push(...found);
    sections.push({ title: current.title, id: current.id, custom: current.custom, line: current.line, blocks });
  };

  let inFence = false;
  lines.forEach((text, index) => {
    if (text.startsWith("```")) inFence = !inFence;
    const heading = inFence ? null : /^## (.+?)(?:\s+\{#([a-z0-9-]+)\})?\s*$/.exec(text);
    if (heading) {
      close();
      const title = (heading[1] ?? "").trim();
      current = { title, id: heading[2] ?? headingId(title), custom: Boolean(heading[2]), line: headerLines + index + 1, lines: [] };
      return;
    }
    if (current) current.lines.push(text);
    else intro.push(text);
  });
  close();

  // A step list before the first heading would have no section to belong to.
  if (intro.some((line) => /^\d+\.\s/.test(line))) {
    problems.push("the method starts before the first ## heading; put every step under a section");
  }

  return { file, data, intro: intro.join("\n").trim(), sections, problems };
}

/** @typedef {ReturnType<typeof parseProcedure>} ParsedProcedure */

/**
 * Every step in the procedure, in order.
 *
 * @param {ParsedProcedure} parsed
 */
export function allSteps(parsed) {
  return parsed.sections.flatMap((section) =>
    section.blocks.flatMap((block) => (block.type === "steps" ? block.steps : [])),
  );
}

/**
 * A step's words with its marks read out, and the temperatures and spins those words state.
 *
 * @param {Step} step
 */
export function stepConditions(step) {
  return readConditions(step.segments.map((s) => segmentText(s)).join(""));
}
