/**
 * Gate: every token and class `.design-sync/conventions.md` names must exist in the stylesheets.
 *
 *   npm run check:design-vocabulary
 *
 * BOUNDARY: it reads conventions.md and the SHEETS array's files off DISK. It does not render, and
 * it says nothing about whether a name is USED WELL, only that the thing it names is real.
 *
 * WHY IT EXISTS. The canvas reads conventions.md every time it designs, and it is the only text
 * the design agent is guaranteed to see. A name that has been deleted from the sheets goes on
 * teaching the agent a site that no longer exists, and nothing else in the repo reads that file.
 *
 * ONE DIRECTION ONLY, DELIBERATELY. Named-but-absent fails; defined-but-unnamed does not. The
 * sheets define 211 tokens and this file rations what the agent reads to a few dozen, so the
 * reverse direction would fail on every token the vocabulary correctly leaves out.
 *
 * TWO TRAPS, BOTH MEASURED BEFORE THIS WAS WRITTEN:
 *
 *   1. A naive `--[a-z0-9-]+` needle matches a markdown table separator, because `---` is two
 *      dashes and a third character the class admits. The needle here requires a LETTER after the
 *      dashes, and only inside backticks.
 *   2. `canvas-constraints.md` names a forbidden token on purpose, as the example of what not to
 *      do. Scoping to conventions.md alone is what keeps that from reading as a violation; do not
 *      widen the scope to the whole README header.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { assertFloor } from "./lib/floor.mjs";
import { readSheets } from "./lib/design-sheets.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONVENTIONS = ".design-sync/conventions.md";

let failures = 0;
let checks = 0;

/** @param {boolean} ok @param {string} label @param {string} [detail] */
function assertThat(ok, label, detail) {
  checks += 1;
  if (ok) return;
  failures += 1;
  console.log(`\n  FAIL  ${label}`);
  if (detail) console.log(`        ${detail}`);
}

/**
 * Backticked words that are not class names: CSS properties and values, HTML elements, media
 * features, attributes and file names. Kept SHORT and PRINTED below, so it cannot quietly grow
 * into an allowlist that hides a real miss.
 */
const NOT_A_CLASS = new Set([
  "body",
  "h3",
  "letter-spacing",
  "prefers-color-scheme",
  "prefers-reduced-transparency",
  "aria-current",
  "data-theme",
]);

const strip = (/** @type {string} */ text) => text.replace(/\/\*[\s\S]*?\*\//g, "");

console.log("\ncheck:design-vocabulary\n");

const sheets = readSheets(REPO);
const css = strip(sheets.map((s) => readFileSync(join(REPO, s), "utf8")).join("\n"));

/* A token is DEFINED where it is declared, never where it is read: `var(--x)` with no `--x:`
   anywhere is exactly the dangling reference this gate is for. */
const defined = new Set([...css.matchAll(/(?:^|[\s;{])(--[a-z][a-z0-9-]*)\s*:/gm)].map((m) => m[1]));
const classes = new Set([...css.matchAll(/\.([a-z][a-z0-9-]*)/g)].map((m) => m[1]));

/*
 * SCOPE FIRST. A scan over an empty needle set reports exactly what a clean sweep reports, so the
 * counts are asserted before any name is judged.
 */
assertThat(sheets.length >= 20, "the sheet list parsed", `${sheets.length} sheets, expected at least 20`);
assertThat(defined.size >= 150, "the sheets parsed into token declarations", `${defined.size} tokens`);
assertThat(classes.size >= 200, "the sheets parsed into class selectors", `${classes.size} classes`);

const prose = readFileSync(join(REPO, CONVENTIONS), "utf8");
const ticked = [...prose.matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim());
assertThat(ticked.length >= 40, `${CONVENTIONS} parsed into backticked names`, `${ticked.length} found`);

/* A LETTER after the dashes, which is what a markdown `---` separator does not have. */
const namedTokens = [...new Set(ticked.filter((t) => /^--[a-z][a-z0-9-]*$/.test(t)))];
const bare = ticked.filter((t) => /^[a-z][a-z0-9-]*$/.test(t) && !NOT_A_CLASS.has(t));
const namedClasses = [...new Set(bare)];
const skipped = [...new Set(ticked.filter((t) => NOT_A_CLASS.has(t)))];

assertThat(namedTokens.length >= 15, "the vocabulary names tokens", `${namedTokens.length} named`);
assertThat(namedClasses.length >= 10, "the vocabulary names classes", `${namedClasses.length} named`);

for (const token of namedTokens) {
  assertThat(
    defined.has(token),
    `${token} is declared in the stylesheets`,
    `${CONVENTIONS} names it and no sheet declares it. The canvas reads that file every time it ` +
      `designs, so a deleted token goes on being taught. Remove the name, or restore the token.`,
  );
}

for (const cls of namedClasses) {
  assertThat(
    classes.has(cls),
    `.${cls} is a selector in the stylesheets`,
    `${CONVENTIONS} names it and no sheet selects it. Remove the name, or add it to NOT_A_CLASS ` +
      `in this gate if it is a property, an element or an attribute rather than a class.`,
  );
}

console.log(
  `\n  ${sheets.length} sheets: ${defined.size} tokens, ${classes.size} classes declared.\n` +
    `  ${CONVENTIONS}: ${namedTokens.length} tokens, ${namedClasses.length} classes named, ` +
    `${prose.length} bytes.\n` +
    `  not treated as classes: ${skipped.join(", ") || "(none)"}`,
);

/* The floor is measured by RUNNING this gate, never counted by hand. */
const MINIMUM_CHECKS = 72;
const breach = assertFloor("check:design-vocabulary", "checks", checks, MINIMUM_CHECKS);
if (breach) assertThat(false, "this gate executed its assertions", breach);

console.log(`\n${checks} checks, ${failures} failures\n`);
if (failures > 0) process.exitCode = 1;
