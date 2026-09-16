/**
 * Gate: `SHEETS` in `.design-sync/build-inputs.mjs` matches the stylesheets the
 * public plane actually loads.
 *
 * ## THE DEFECT, AND NOTES.md PREDICTED IT IN WRITING
 *
 * `.design-sync/NOTES.md` says, under Re-sync risks:
 *
 *   "The stylesheet list in build-inputs.mjs is hand-maintained and will go
 *   stale. A sheet added to app/root.tsx or to a public route does not appear
 *   here on its own. Diff SHEETS against root.tsx's imports and the non-admin
 *   app/routes/*.tsx imports before trusting a re-sync."
 *
 * Nobody ran that diff. `app/styles/shell.css` was imported by `app/root.tsx`
 * and absent from `SHEETS`, so it never reached `ds-styles.css`, never reached
 * `_ds_bundle.css`, and never reached the canvas. That sheet DEFINES `.tracks`
 * and carries the "NAMED `.tracks`, NOT `.page`" reasoning (ruling 99), so the
 * design agent was redesigning against a grid class it had never been shown.
 * Ruling 111 turned the sentence into this instrument.
 *
 * A prediction written in prose is a prediction nothing re-checks. That is the
 * same shape as the carried-token map's build-4 deadline and vol 18's freeze
 * point: a rule enforced by whoever happens to read it.
 *
 * ## OFFLINE TIER
 *
 * It reads `.design-sync/build-inputs.mjs`, `app/root.tsx`, `app/routes/*.tsx`
 * and the stylesheets they name, all off disk. No network, no binding, no
 * clock. A clean checkout can run it, so `--ci` does too.
 *
 * ## BOTH DIRECTIONS, because one of them is the silent one
 *
 * A sheet LOADED but not SYNCED is the defect above: the canvas designs blind
 * and nothing says so. A sheet SYNCED but no longer LOADED is the quieter one:
 * the bundle carries rules the site has stopped applying, so the canvas is
 * told about a surface that no longer exists. Neither direction reports
 * itself, so both are asserted here.
 *
 * ## WHAT IS DELIBERATELY NOT HERE
 *
 * No copy of the sheet list. `SHEETS` is parsed out of `build-inputs.mjs`,
 * which stays its one owner (hard rule 17): a mirror here would be a second
 * list to keep in step, which is the very failure being gated.
 *
 * CASCADE ORDER is checked for the root-imported sheets only. NOTES.md:
 * "Cascade order is load-bearing and is not alphabetical. SHEETS reproduces
 * root.tsx's deliberate order; sorting it would move the cascade." Across
 * ROUTES there is no defined order -- route sheets load after the root
 * module's and no two routes race -- so ordering is asserted exactly where the
 * repo defines one and nowhere else.
 *
 * COMMENTS ARE STRIPPED BEFORE MATCHING, and this is not hygiene. `app.css`
 * line 1937 carries prose about having removed `@import "tailwindcss"`, and
 * the converter's own validator failed that sentence twice as a missing
 * import (NOTES.md, converter defect 3). A gate that matched it would inherit
 * the identical bug -- hard rule 10, "strip comments before matching".
 *
 * ## TWO WAYS A SHEET REACHES A READER, and the first draft knew only one
 *
 * A bare `import "./x.css";` joins the bundled cascade. A `?url` side-load
 * (`import href from "~/styles/x.css?url"`) ships the sheet as its own file
 * that a component links at the point of use. Both reach readers; only the
 * first has a cascade POSITION.
 *
 * Scanning only the cascade form reported `palette-dialog.css` as orphaned:
 * `app/components/search-trigger.tsx` side-loads it, and `ask.css` beside it.
 * That was this gate failing, not the repo -- so the scan covers components
 * and counts both forms, and only cascade imports from root.tsx are ordered.
 *
 * ## THE ONE EXCLUSION IS NOTES.md's, NOT THIS FILE'S
 *
 * `katex.generated.css` is side-loaded by root.tsx and is deliberately out of
 * sync scope: NOTES.md excludes `katex*` as "a generated artifact carrying
 * twenty font faces whose binaries would have to ship too". It is named here
 * as ONE path rather than a prefix, because an exclusion written as a pattern
 * excludes everything that ever matches it (hard rule 10, "enumerate inside
 * exclusions"), and the scope assertion below refuses a list that has grown.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFloor } from "./lib/floor.mjs";
import { readSheets } from "./lib/design-sheets.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUILD_INPUTS = ".design-sync/build-inputs.mjs";
const ROOT_TSX = "app/root.tsx";
const ROUTES_DIR = "app/routes";
const COMPONENTS_DIR = "app/components";

/**
 * Sheets the public plane loads that the sync deliberately does not carry.
 * Exact paths, never prefixes. Grounds live in NOTES.md, which owns the
 * decision; this list only has to stay short enough to read.
 */
const OUT_OF_SCOPE = ["app/styles/katex.generated.css"];
const MAXIMUM_EXCLUSIONS = 2;

/**
 * Below these the scan has stopped reading rather than found a clean tree. A
 * search over an empty scope reports what a clean sweep reports (hard rule 10),
 * so each is asserted before any conclusion is drawn from a count.
 */
const MINIMUM_SHEETS = 15;
const MINIMUM_IMPORTERS = 20;
const MINIMUM_CHECKS = 7;

let checks = 0;
/** @type {string[]} */
const failures = [];

/** @param {string} label @param {boolean} pass @param {string} detail */
function ok(label, pass, detail) {
  checks += 1;
  if (pass) {
    console.log(`  ok    ${label}`);
    return;
  }
  console.log(`  FAIL  ${label}`);
  failures.push(`${label}: ${detail}`);
}

/**
 * Repo-relative, forward-slashed, so every comparison is on one spelling.
 * @param {string} abs
 */
function rel(abs) {
  return relative(REPO, abs).split(sep).join("/");
}

/** @param {string} source */
function stripBlockComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** @param {string} source */
function stripLineComments(source) {
  return source.replace(/^[ \t]*\/\/.*$/gm, "");
}

/**
 * Every `.css` a TS/TSX module imports for its side effects: the bundled
 * cascade. The quote-terminated `.css` excludes `?url` by construction.
 * @param {string} source @returns {string[]}
 */
function cssCascadeImports(source) {
  const clean = stripLineComments(stripBlockComments(source));
  return [...clean.matchAll(/import\s+"([^"]+\.css)"\s*;/g)].map((m) => m[1]);
}

/**
 * Every `.css?url` side-load: shipped as its own file and linked at the point
 * of use, so it reaches readers without having a cascade position.
 * @param {string} source @returns {string[]}
 */
function cssUrlSideLoads(source) {
  const clean = stripLineComments(stripBlockComments(source));
  return [...clean.matchAll(/from\s+"([^"]+\.css)\?url"/g)].map((m) => m[1]);
}

/**
 * `@import "./x.css";` inside a stylesheet, comments already stripped.
 * @param {string} source @returns {string[]}
 */
function cssAtImports(source) {
  const clean = stripBlockComments(source);
  return [...clean.matchAll(/@import\s+"([^"]+\.css)"\s*;/g)].map((m) => m[1]);
}

/**
 * Resolve an import specifier to a repo-relative path. `~/` is the app alias.
 * @param {string} spec @param {string} fromFileAbs
 */
function resolveSpec(spec, fromFileAbs) {
  if (spec.startsWith("~/")) return `app/${spec.slice(2)}`;
  if (spec.startsWith("./") || spec.startsWith("../")) {
    return rel(resolve(dirname(fromFileAbs), spec));
  }
  return null; // a bare package specifier is not a repo sheet
}

function main() {
  const sheets = readSheets(REPO);
  ok(
    `SHEETS parsed from ${BUILD_INPUTS}`,
    sheets.length >= MINIMUM_SHEETS,
    `parsed ${sheets.length}, expected at least ${MINIMUM_SHEETS}. A short list ` +
      `means the parse broke, and an empty scope reports what a clean sweep reports.`,
  );
  if (sheets.length < MINIMUM_SHEETS) return;

  ok(
    "the out-of-scope list is still short enough to read",
    OUT_OF_SCOPE.length <= MAXIMUM_EXCLUSIONS,
    `${OUT_OF_SCOPE.length} exclusions against a ceiling of ${MAXIMUM_EXCLUSIONS}. ` +
      `An exclusion list that grows is a gate quietly narrowing its own scope; ` +
      `each entry needs grounds in NOTES.md and a raise here is a decision.`,
  );

  // The importers: root.tsx, every non-admin route, every non-admin component.
  const importers = [join(REPO, ROOT_TSX)];
  for (const dir of [ROUTES_DIR, COMPONENTS_DIR]) {
    for (const name of readdirSync(join(REPO, dir))) {
      if (!name.endsWith(".tsx")) continue;
      if (name.startsWith("admin")) continue; // the admin plane is out of sync scope
      importers.push(join(REPO, dir, name));
    }
  }
  ok(
    "importers found to scan",
    importers.length >= MINIMUM_IMPORTERS,
    `found ${importers.length}, expected at least ${MINIMUM_IMPORTERS}. ` +
      `${ROUTES_DIR} or ${COMPONENTS_DIR} did not read as expected, and a scan over ` +
      `an empty scope reports what a clean sweep reports.`,
  );
  if (importers.length < MINIMUM_IMPORTERS) return;

  /** @type {Map<string, string[]>} sheet -> who pulls it in */
  const loaded = new Map();
  /** @type {string[]} root.tsx's own order, which is the cascade */
  const rootOrder = [];

  /** @param {string} sheet @param {string} by */
  const note = (sheet, by) => {
    const who = loaded.get(sheet) ?? [];
    if (!who.includes(by)) who.push(by);
    loaded.set(sheet, who);
  };

  const excluded = new Set(OUT_OF_SCOPE);
  /**
   * A path this gate is responsible for. Narrows away null so every caller
   * downstream has a string, which is the same reason it is a type predicate
   * rather than a plain boolean.
   * @param {string | null} sheet @returns {sheet is string}
   */
  const keep = (sheet) => sheet !== null && !sheet.includes("/admin") && !excluded.has(sheet);

  for (const file of importers) {
    if (!existsSync(file)) continue;
    const source = readFileSync(file, "utf8");
    for (const spec of cssCascadeImports(source)) {
      const sheet = resolveSpec(spec, file);
      if (!keep(sheet)) continue;
      note(sheet, rel(file));
      if (file.endsWith("root.tsx")) rootOrder.push(sheet);
    }
    // Side-loads reach readers too, but have no cascade position, so they are
    // never added to rootOrder.
    for (const spec of cssUrlSideLoads(source)) {
      const sheet = resolveSpec(spec, file);
      if (!keep(sheet)) continue;
      note(sheet, `${rel(file)} (?url)`);
    }
  }

  // Follow CSS-level @imports transitively: app.css pulls reset.css in, and a
  // sheet reached that way is every bit as loaded as one named in a module.
  const queue = [...loaded.keys()];
  while (queue.length > 0) {
    const sheet = queue.shift();
    if (sheet === undefined) break;
    const abs = join(REPO, sheet);
    if (!existsSync(abs)) continue;
    for (const spec of cssAtImports(readFileSync(abs, "utf8"))) {
      const target = resolveSpec(spec, abs);
      if (!keep(target)) continue;
      if (!loaded.has(target)) queue.push(target);
      note(target, sheet);
    }
  }

  const inSheets = new Set(sheets);

  // Direction 1 - the shell.css defect: loaded by the site, never synced.
  const unsynced = [...loaded.keys()].filter((s) => !inSheets.has(s)).sort();
  ok(
    "every loaded public stylesheet is in SHEETS",
    unsynced.length === 0,
    unsynced
      .map((s) => `${s} is loaded by ${(loaded.get(s) ?? []).join(", ")} but is not in SHEETS`)
      .join("; ") +
      `. The canvas is designing against rules it has never been sent. Add it to ` +
      `SHEETS at the cascade position its importer gives it.`,
  );

  // Direction 2 - the quiet one: synced, but the site no longer loads it.
  const orphaned = sheets.filter((s) => !loaded.has(s)).sort();
  ok(
    "every SHEETS entry is loaded by the public plane",
    orphaned.length === 0,
    orphaned.map((s) => `${s} is in SHEETS but no non-admin module or stylesheet imports it`).join("; ") +
      `. The bundle would describe a surface the site has stopped applying.`,
  );

  // Every entry must also exist, or the generator reads a missing file.
  const missingOnDisk = sheets.filter((s) => !existsSync(join(REPO, s))).sort();
  ok(
    "every SHEETS entry exists on disk",
    missingOnDisk.length === 0,
    `${missingOnDisk.join(", ")} named in SHEETS with no file at that path.`,
  );

  // Cascade order, for the sheets root.tsx names. SHEETS must list them in the
  // same relative order; entries root.tsx does not import (reset.css arrives by
  // @import, route sheets by their routes) are not constrained here.
  const rootInSheets = sheets.filter((s) => rootOrder.includes(s));
  const expected = rootOrder.filter((s) => inSheets.has(s));
  ok(
    "SHEETS preserves root.tsx's cascade order",
    rootInSheets.join(" > ") === expected.join(" > "),
    `SHEETS has ${rootInSheets.join(" > ")}; root.tsx loads ${expected.join(" > ")}. ` +
      `That list IS the cascade and sorting it moves the cascade.`,
  );

  console.log(
    `\n  ${sheets.length} SHEETS entries, ${loaded.size} stylesheets loaded by ` +
      `${importers.length} public modules`,
  );

  const breach = assertFloor("check:design-sheets", "checks", checks, MINIMUM_CHECKS);
  if (breach) ok("this gate executed its assertions", false, breach);
}

try {
  main();
  if (failures.length > 0) {
    console.error(`\n${failures.length} FAILED of ${checks} checks:\n`);
    for (const f of failures) console.error(`  ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`\n${checks} checks, 0 failures`);
  }
} catch (error) {
  console.error(
    `\ncheck:design-sheets could not run: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
