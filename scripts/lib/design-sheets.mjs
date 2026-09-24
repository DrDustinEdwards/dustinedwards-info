import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

/**
 * @param {string} text
 */
export function textSha(text) {
  return createHash("sha256").update(text).digest("hex");
}

/** @param {string} path */
export function fileSha(path) {
  return textSha(readFileSync(path, "utf8"));
}

/**
 * Length-prefixed, not NUL-delimited: a NUL would be a raw control byte in a tracked file, which
 * test/control-characters.test.mjs refuses.
 *
 * @param {string} repo
 * @param {string[]} sheets
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
 * Throws rather than returning []: a search over an empty scope looks exactly like a clean sweep.
 *
 * @param {string} repo
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
 * @param {string} css
 * @returns {{ text: string, line: number }[]}
 */
export function commentBlocks(css) {
  /** @type {{ text: string, line: number }[]} */
  const out = [];
  const rx = /\/\*[\s\S]*?\*\//g;
  let m;
  while ((m = rx.exec(css)) !== null) {
    const line = css.slice(0, m.index).split("\n").length;
    out.push({ text: m[0], line });
  }
  return out;
}

/**
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
