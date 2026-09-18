/**
 * Gate: the design sync's sheet list matches the stylesheets the public plane actually loads.
 *
 *   npm run check:design-sheets
 *
 * BOUNDARY: it reads the list, the root module, the routes and the stylesheets they name, all off
 * disk and both directions, and nothing here restates the list, whose one owner hard rule 17
 * names. Comments are stripped before matching, which is hard rule 10: a stylesheet carries prose
 * about an `@import` it removed. The one exclusion is named as ONE path rather than a prefix,
 * which is hard rule 10 again, enumerate inside exclusions.
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
 * Sheets the public plane loads that the sync deliberately does not carry. Exact paths, never
 * prefixes; the grounds live in the notes, which own the decision.
 */
const OUT_OF_SCOPE = ["app/styles/katex.generated.css"];
const MAXIMUM_EXCLUSIONS = 2;

/**
 * Below these the scan has stopped reading rather than found a clean tree: a search over an empty
 * scope reports what a clean sweep reports (hard rule 10).
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
   * A path this gate is responsible for. Narrows away null, which is why it is a type predicate.
   *
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

  // Cascade order, for the sheets the root module names. The list must carry them in the same
  // relative order; entries it does not import, arriving by `@import` or by their routes, are not
  // constrained here.
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
