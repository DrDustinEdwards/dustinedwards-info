/**
 * Gate: no script addresses the site database BY NAME for a remote operation.
 *
 *   npm run check:d1-address
 *
 * THE DEFECT: the by-name spelling resolves through the gitignored config's entry and uses THAT
 * entry's id, and a clean checkout bootstraps that file with a placeholder, so the name addresses
 * a database that does not exist ON A RUNNER AND ONLY THERE. Two gates had it and one had never
 * run in CI, so nothing had noticed; the repair is an instrument rather than a sweep.
 *
 * REFUSED: a `d1` subcommand whose database argument is the NAME, in a segment that is not
 * `--local`. ALLOWED, deliberately: `--local`, where Miniflare keys state by the config id and
 * there is no account-side UUID to resolve; `d1 list`, the lookup itself; and `d1 migrations`,
 * applied through wrangler by design.
 *
 * SCOPE IS PROVEN NON-EMPTY, this being a per-file loop over a glob, hard rule 10. COMMENTS ARE
 * STRIPPED FIRST: every one of these files DESCRIBES the defect in prose, this one included.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { assertFloor } from "./lib/floor.mjs";
import { stripComments } from "./lib/strip-comments.mjs";

const SCRIPTS_DIR = "scripts";

/** The database this rule is about. Read from the one module that owns it. */
const DB_NAME = "dustinedwards";

/**
 * Files whose `d1` strings are FIXTURES, never invocations. ENUMERATED AND ARGUED, never a glob:
 * an exclusion naming a file excludes everything in it, so each states why the rule does not reach
 * it.
 */
/** @type {Record<string, string>} */
const EXEMPT = {
  "check-hook-scope.mjs":
    "its d1 strings are PAYLOADS fed to the deploy hook on stdin, to prove the " +
    "hook blocks a remote DELETE and allows a remote SELECT. They are never run " +
    "as commands, and rewriting them to a UUID would make the gate stop testing " +
    "the spelling a session would actually type.",
  "check-d1-address.mjs":
    "this file, which carries the needle and the example of what it refuses.",
};

/** @type {string[]} */
const failures = [];
let checks = 0;

/** @param {string} label @param {boolean} passed @param {string} [detail] */
function ok(label, passed, detail = "") {
  checks += 1;
  if (!passed) failures.push(detail ? `${label}: ${detail}` : label);
}

console.log("\ncheck:d1-address\n");

const entries = (await readdir(SCRIPTS_DIR, { withFileTypes: true }))
  .filter((e) => e.isFile() && e.name.endsWith(".mjs"))
  .map((e) => e.name)
  .sort();

const libEntries = (await readdir(join(SCRIPTS_DIR, "lib"), { withFileTypes: true }))
  .filter((e) => e.isFile() && e.name.endsWith(".mjs"))
  .map((e) => join("lib", e.name))
  .sort();

const files = [...entries, ...libEntries];

ok(
  "there are scripts to scan",
  files.length > 0,
  `${SCRIPTS_DIR}/ yielded no .mjs files. A sweep over an empty scope reports ` +
    `exactly what a clean sweep reports, so an empty one is a failure.`,
);
if (failures.length > 0) {
  console.error(`check:d1-address FAILED:\n\n  ${failures.join("\n  ")}\n`);
  process.exit(1);
}

/**
 * A `d1` subcommand followed by the database NAME, in either spelling: the literal and the
 * interpolation several scripts bind to it, because a needle for the literal alone would miss
 * every site of the second kind. `d1 list` cannot match, taking no database argument.
 */
/*
 * THE WORD BOUNDARY GOES INSIDE THE FIRST ALTERNATIVE, NOT AFTER THE GROUP. A trailing `\b` can
 * never match the interpolated alternative, `}` being a non-word character followed by a space,
 * so the needle was BLIND to most of the sites and read as a nearly clean repo. Caught by counting
 * the sites and disbelieving the number, which is why the count is printed.
 */
const BY_NAME = new RegExp(
  String.raw`\bd1\s+([a-z-]+)\s+(?:` + DB_NAME + String.raw`\b|\$\{DB_NAME\})`,
  "g",
);

/** Subcommands the rule does not reach, each with its reason. */
const EXEMPT_SUBCOMMANDS = new Set(["migrations", "list"]);

let scanned = 0;
let sites = 0;

for (const name of files) {
  const base = name.replace(/^lib[\\/]/, "");
  if (EXEMPT[base]) continue;

  const raw = await readFile(join(SCRIPTS_DIR, name), "utf8");
  // `preserveLines`, because a reported line number that does not match the file sends the reader
  // to the wrong place with confidence.
  const source = stripComments(raw, { preserveLines: true });
  scanned += 1;

  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    BY_NAME.lastIndex = 0;
    let match;
    while ((match = BY_NAME.exec(line)) !== null) {
      const subcommand = match[1];
      if (EXEMPT_SUBCOMMANDS.has(subcommand)) continue;
      sites += 1;
      /*
       * `--local` ON THE SAME LINE is what makes the name correct, read from the line rather than the
       * file so a `--local` belonging to another command cannot license this one.
       */
      const local = /--local\b/.test(line);
      ok(
        `${name}:${i + 1} addresses ${DB_NAME} by name`,
        local,
        `\`d1 ${subcommand} ${DB_NAME}\` with no --local on the line. Wrangler ` +
          `resolves that name out of wrangler.jsonc, which a clean checkout ` +
          `bootstraps from the example with the zero placeholder id, so this ` +
          `addresses a database that does not exist on a runner and only there. ` +
          `Use resolveD1Address from scripts/lib/d1-address.mjs.\n        ` +
          `        line: ${line.trim().slice(0, 160)}`,
      );
    }
  }
}

console.log(`  ${scanned} script(s) scanned, ${sites} by-name d1 site(s) found.`);

/*
 * THE SITES ARE COUNTED AND THE COUNT IS PRINTED, because "0 violations" and "0 lines examined"
 * are otherwise the same output. Every assertion here comes from a site, so the scope assertion is
 * separate and unconditional.
 */
const MINIMUM_CHECKS = 1;
const floorBreach = assertFloor(
  "check:d1-address",
  "checks",
  checks,
  MINIMUM_CHECKS,
  "The scope assertion always runs, so a count below one means the file list itself was skipped.",
);
if (floorBreach) failures.push(floorBreach);

if (failures.length > 0) {
  console.error(`\ncheck:d1-address FAILED, ${failures.length} of ${checks} checks:\n`);
  for (const f of failures) console.error(`  ${f}\n`);
  process.exit(1);
}

console.log(
  `\ncheck:d1-address ok. ${checks} assertion(s) over ${scanned} script(s); every ` +
    `by-name d1 site carries --local, and every remote one resolves a UUID.\n`,
);
