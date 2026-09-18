/**
 * One reader for the design-sync sheet list, and one parser for a stylesheet's comment blocks.
 *
 * Both callers must read the SAME array out of its one owner (hard rule 17). Two hand-rolled
 * parsers would be a second and third place for the shape of that array to be known, and the gate
 * exists precisely because a hand-maintained second copy went stale. Hard rule 10, one helper
 * name and one argument order: both callers use these and no local variant.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The sheet array, parsed from its owner. Throws rather than returning an empty list: a search
 * over an empty scope reports exactly what a clean sweep reports, so a broken parse must be a
 * refusal and never a quiet zero.
 *
 * @param {string} repo absolute path to the repo root
 * @returns {string[]} repo-relative stylesheet paths, in cascade order
 */
export function readSheets(repo) {
  const path = join(repo, ".design-sync/build-inputs.mjs");
  const src = readFileSync(path, "utf8");
  const block = src.match(/const SHEETS = \[([\s\S]*?)\n\];/);
  if (!block) {
    throw new Error(
      `.design-sync/build-inputs.mjs: no \`const SHEETS = [ ... ];\` array found. ` +
        `Its readers parse that array rather than carrying a copy, so a rename ` +
        `there is a refusal here, never a silent pass.`,
    );
  }
  const sheets = [...block[1].matchAll(/"([^"]+\.css)"/g)].map((m) => m[1]);
  if (sheets.length === 0) {
    throw new Error(".design-sync/build-inputs.mjs: SHEETS parsed to zero entries.");
  }
  return sheets;
}

/**
 * Every comment block in a stylesheet, with the 1-indexed line it starts on so an extract can
 * point back at its owner.
 *
 * @param {string} css
 * @returns {{ text: string, line: number }[]}
 */
export function commentBlocks(css) {
  /** @type {{ text: string, line: number }[]} */
  const out = [];
  const rx = /\/\*[\s\S]*?\*\//g;
  let m;
  while ((m = rx.exec(css)) !== null) {
    // Counting newlines before the match is linear per block and the sheets are small; a running
    // index would be faster and easier to get wrong.
    const line = css.slice(0, m.index).split("\n").length;
    out.push({ text: m[0], line });
  }
  return out;
}

/**
 * A comment block's prose, with the comment furniture removed: the opening and closing markers,
 * the leading star on each continuation line, and the rule bars some sections use as dividers.
 *
 * @param {string} block
 * @returns {string}
 */
export function commentProse(block) {
  return block
    .replace(/^\/\*+/, "")
    .replace(/\*+\/$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trimEnd())
    .map((line) => (/^[-=]{4,}$/.test(line.trim()) ? "" : line))
    .join("\n")
    .trim();
}
