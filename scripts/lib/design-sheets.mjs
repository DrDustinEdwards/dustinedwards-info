/**
 * One reader for the design-sync sheet list, and one parser for a stylesheet's comment blocks.
 *
 * BOUNDARY: both callers read the SAME array out of its one owner through these
 * names and no local variant, which is the vacuity rule's one helper name and one argument order.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

/**
 * The hash recipe the input stamp is written with and read back by, in ONE place because the
 * writer (`.design-sync/build-inputs.mjs`) and any reader must agree byte for byte: a recipe
 * stated twice drifts the day the two spellings do.
 *
 * @param {string} text
 */
export function textSha(text) {
  return createHash("sha256").update(text).digest("hex");
}

/** @param {string} path absolute */
export function fileSha(path) {
  return textSha(readFileSync(path, "utf8"));
}

/**
 * One hash over the sheet list AS COMPILED: each path with its contents, so a reordering is a
 * different hash and a rename cannot collide with an edit.
 *
 * LENGTH-PREFIXED rather than separated by a delimiter. A delimiter has to be a byte the content
 * cannot contain, and the obvious choice is a NUL, which would be a raw control character in a
 * tracked file: `test/control-characters.test.mjs` refuses those, having been added because an escape
 * written in prose reached disk as a control byte three times. A byte count cannot collide and
 * cannot be typed by accident.
 *
 * @param {string} repo absolute path to the repo root
 * @param {string[]} sheets repo-relative paths, in cascade order
 */
export function sheetsSha(repo, sheets) {
  return textSha(
    sheets
      .map((rel) => {
        const css = readFileSync(join(repo, rel), "utf8");
        return `${rel} ${css.length}\n${css}`;
      })
      .join("\n"),
  );
}

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
