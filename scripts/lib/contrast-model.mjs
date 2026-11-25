/** check:contrast's palette model: the parsed token blocks, the pair measure and the tally every pass reports into. */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTally } from "@dustinedwards/devkit/node";
import { contrast } from "../../app/lib/contrast.mjs";
import { THEME_SELECTORS, tokenBlock } from "./tokens.mjs";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const light = tokenBlock("light", THEME_SELECTORS.light);
export const darkMedia = tokenBlock("dark (prefers-color-scheme)", THEME_SELECTORS.darkSystem);
export const darkAttr = tokenBlock("dark (attribute)", THEME_SELECTORS.dark);

/* Canary: the first selector match wins; `--page-paper` is only in the palette blocks. */
/** @type {Array<[string, Record<string, string>]>} */
const PALETTE_BLOCKS = [
  ["light", light],
  ["dark (prefers-color-scheme)", darkMedia],
  ["dark (attribute)", darkAttr],
];
for (const [label, block] of PALETTE_BLOCKS) {
  if (!("--page-paper" in block)) {
    throw new Error(
      `${label}: the block parsed for this selector does not declare --page-paper, so it is not the palette ` +
        `block. A theme block was almost certainly added above the palette; move it below.`,
    );
  }
}

export const tally = createTally({ print: false });
export const { ok: assert, fail } = tally;

/**
 * One measured pair, counted once and failed below `min`, in the one shape every pair reports.
 *
 * @param {string} head
 * @param {string} fg
 * @param {string} bg
 * @param {number} min
 * @param {{ fgShown?: string, bgShown?: string }} [shown] the names printed beside the values
 */
export function assertPair(head, fg, bg, min, { fgShown = fg, bgShown = bg } = {}) {
  const ratio = contrast(fg, bg);
  assert(
    `${head}\n    ${fgShown} on ${bgShown}\n    ${ratio.toFixed(2)}:1, needs ${min}:1`,
    !(ratio < min),
  );
  return ratio;
}

/** @type {Array<[string, Record<string, string>]>} */
export const MODES = [
  ["light", light],
  ["dark", darkAttr],
];
