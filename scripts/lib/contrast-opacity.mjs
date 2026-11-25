/** check:contrast's opacity pass: every partial opacity in the source stylesheets is classified, and every exemption is live. */

import { readFileSync } from "node:fs";
import { OPACITY_EXEMPT } from "./contrast-matrix.mjs";
import { stylesheetPaths } from "./tokens.mjs";
import { assert } from "./contrast-model.mjs";

/**
 * @param {string} selectorGroup
 * @returns {boolean}
 */
function opacityExempt(selectorGroup) {
  const members = selectorGroup
    .split(",")
    .map((one) => one.trim())
    .filter(Boolean);
  if (members.length === 0) return false;
  return members.every((/** @type {string} */ one) =>
    OPACITY_EXEMPT.some((entry) => entry.test.test(one)),
  );
}

export function checkOpacity() {
  /** @type {Array<{ file: string, selector: string, value: string }>} */
  const partial = [];
  /** @type {string[]} */
  const unparsed = [];
  let declarations = 0;

  for (const file of stylesheetPaths()) {
    const text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    const stripped = text.replace(/\/\*[\s\S]*?\*\//g, "");
    const name = file.split(/[\\/]/).slice(-1)[0];

    for (const match of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = match[1]
        .trim()
        .split("\n")
        .map((l) => l.trim())
        .join(" ");
      const block = match[2];
      /* Every opacity declaration, whatever its value grammar: one this scan cannot read as a
         number (var(), calc()) is reported, not skipped, or it would escape classification. */
      for (const decl of block.matchAll(/(?:^|;)\s*opacity\s*:\s*([^;]+?)\s*(?:;|$)/g)) {
        declarations += 1;
        const value0 = decl[1].replace(/\s*!important$/, "");
        /* var(--enarratio-opacity-dimmed, 0.25): nothing declares the knob, so it is the fallback. */
        const raw = /^var\(\s*--[A-Za-z0-9_-]+\s*,\s*([^()]+?)\s*\)$/.exec(value0)?.[1] ?? value0;
        const number = /^(\d*\.?\d+)(%?)$/.exec(raw);
        if (!number) {
          unparsed.push(`${name} ${selector}: opacity ${decl[1]}`);
          continue;
        }
        const value = Number(number[1]) / (number[2] === "%" ? 100 : 1);
        if (value > 0 && value < 1) partial.push({ file: name, selector, value: decl[1] });
      }
    }
  }

  /* Scope floor: a regex that stopped matching reports what a clean sweep reports. */
  assert(`the opacity scan read declarations at all (${declarations} found)`, declarations >= 5);

  assert(
    unparsed.length === 0
      ? "every opacity value is a number this scan can classify"
      : `UNREADABLE opacity value(s), so they cannot be classified: ${unparsed.join("; ")}`,
    unparsed.length === 0,
  );

  const unclassified = partial.filter((d) => !opacityExempt(d.selector));
  assert(
    unclassified.length === 0
      ? "every partial opacity is classified"
      : `UNCLASSIFIED partial opacity: ${unclassified
          .map((d) => `${d.file} ${d.selector} at ${d.value}`)
          .join("; ")}`,
    unclassified.length === 0,
  );

  const stale = OPACITY_EXEMPT.filter(
    (entry) =>
      !partial.some((d) =>
        d.selector.split(",").some((/** @type {string} */ one) => entry.test.test(one.trim())),
      ),
  ).map((entry) => String(entry.test));
  assert(
    stale.length === 0
      ? "every opacity exemption covers a live declaration"
      : `STALE opacity exemption(s): ${stale.join(", ")}`,
    stale.length === 0,
  );
}
