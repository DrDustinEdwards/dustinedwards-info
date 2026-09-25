import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { doiKey } from "../build-publications.mjs";
import { assertFloor } from "../lib/floor.mjs";
import { createTally } from "../lib/tally.mjs";
import { stripTsxComments } from "../lib/strip-comments.mjs";

/*
 * What every publications part reads, loaded once: a module is evaluated once however many parts
 * import it. It asserts nothing itself; each part counts its own checks against its own floor.
 */

export const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * The paper route, read once and stripped by the TSX parser: the route discusses the builders it
 * calls in prose, and a `//` regex also ate every `https://` inside a string.
 */
export const SLUG_ROUTE = stripTsxComments(
  readFileSync(join(root, "app", "routes", "publications.$slug.tsx"), "utf8"),
);

export const SITE_PATH = join(root, "data", "publications.site.json");
export const CSL_PATH = join(root, "data", "publications.csl.json");
export const OUT_PATH = join(root, "app", "data", "publications.ts");

for (const [label, path] of [
  ["the site file", SITE_PATH],
  ["the CSL file", CSL_PATH],
  ["the generated module", OUT_PATH],
]) {
  if (!existsSync(path)) {
    console.log(`  FAIL  publications: ${label} is missing: ${path}`);
    throw new Error(`publications: ${label} is missing`);
  }
}

export const site = JSON.parse(readFileSync(SITE_PATH, "utf8"));
const cslParsed = JSON.parse(readFileSync(CSL_PATH, "utf8"));
export const siteEntries = Object.entries(site);

if (siteEntries.length === 0 || !Array.isArray(cslParsed) || cslParsed.length === 0) {
  console.log(
    `  FAIL  publications: both source files carry records (site ${siteEntries.length}, ` +
      `csl ${Array.isArray(cslParsed) ? cslParsed.length : "not an array"})`,
  );
  throw new Error("publications: the scope is empty; nothing below would mean anything");
}

/** @type {any[]} Narrowed by the guard above. */
export const csl = cslParsed;

export const hosted = siteEntries.filter(([, f]) => f.pdfPath);

export const TEXT_PATH = join(root, "data", "publications.text.json");

export const extracted = existsSync(TEXT_PATH)
  ? JSON.parse(readFileSync(TEXT_PATH, "utf8"))
  : { papers: {} };
export const extractedPapers = extracted.papers ?? {};
export const extractedKeys = new Set(Object.keys(extractedPapers).map((d) => doiKey(d)));

/**
 * The tally a part counts on, after its heading.
 *
 * @param {string} name
 */
export function openPart(name) {
  const tally = createTally({ printPass: true });
  console.log(`\n  publications: ${name}\n`);
  return { tally, ok: tally.ok };
}

/**
 * The part's floor, failed without counting a check so the count is the sweeps alone, and the
 * outcome the runner reads. The runner fails a part only on zero checks, so without a floor a
 * refactor could drop most of a part's sweeps and still pass.
 *
 * @param {ReturnType<typeof createTally>} tally
 * @param {string} name
 * @param {number} minimum
 */
export function closePart(tally, name, minimum) {
  const breach = assertFloor(
    `check:machine-readable/publications-${name}`,
    "checks",
    tally.checks,
    minimum,
    "The runner fails a part only on zero checks, so without this a refactor could drop " +
      "most of its sweeps and still pass.",
  );
  if (breach) {
    console.log(`  FAIL  ${breach}`);
    tally.fail(breach);
  }
  return { checks: tally.checks, failures: tally.failures };
}
