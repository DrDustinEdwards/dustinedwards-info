/**
 * Gate: no script addresses the site database BY NAME for a remote operation.
 *
 *   npm run check:d1-address
 *
 * ## THE DEFECT THIS REFUSES, measured in CI on 2026-09-08
 *
 * `wrangler d1 <cmd> dustinedwards` resolves the name through the
 * `d1_databases` entry in `wrangler.jsonc`, and uses THAT ENTRY'S id.
 * `wrangler.jsonc` is gitignored; a clean checkout bootstraps it from
 * `wrangler.jsonc.example`, whose id is the zero placeholder. So the by-name
 * spelling addresses a database that does not exist ON A RUNNER AND ONLY
 * THERE, and dies as 7404.
 *
 * `check:restore` found it the expensive way (run 34301357787). `check:backup`
 * had the same defect and had never run in CI, so nothing had noticed. The
 * queued item that produced this gate asked for it before a third victim was
 * found by a red run, which is the "a fix in N-1 of N sites is not a fix" shape
 * in FAILURES.md answered with an instrument instead of a sweep.
 *
 * ## WHAT IS REFUSED, AND WHAT IS NOT
 *
 * Refused: a `d1` subcommand whose database argument is the NAME, in a segment
 * that is not `--local`. `resolveD1Address` in `scripts/lib/d1-address.mjs` is
 * the only production spelling: it asks the account for the UUID and fails
 * closed.
 *
 * Allowed, deliberately:
 *
 *   `--local`      Miniflare keys state by the config id and there is no
 *                  account-side UUID to resolve. Asking for one would answer a
 *                  question about a different database.
 *   `d1 list`      the lookup itself, which takes no database argument.
 *   `d1 migrations` applied through wrangler by design (CLAUDE.md, Commands).
 *
 * ## SCOPE IS PROVEN NON-EMPTY BEFORE ANYTHING IS ASSERTED
 *
 * A sweep over zero files reports exactly what a clean sweep reports, and this
 * gate is a per-file loop over a glob. Hard rule 10, first discipline.
 *
 * ## COMMENTS ARE STRIPPED FIRST
 *
 * Every one of these files DESCRIBES the defect in prose, this one included. A
 * needle that matched a comment would fire on the documentation of the rule it
 * enforces, which is the "a comment can satisfy an assertion about code, and
 * can fail one" shape.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { assertFloor } from "./lib/floor.mjs";
import { stripComments } from "./lib/strip-comments.mjs";

const SCRIPTS_DIR = "scripts";

/** The database this rule is about. Read from the one module that owns it. */
const DB_NAME = "dustinedwards";

/**
 * Files whose `d1 ... dustinedwards` strings are FIXTURES, never invocations.
 *
 * ENUMERATED AND ARGUED, never a glob. An exclusion naming a file excludes
 * everything in it, so each one states what it is and why the rule does not
 * reach it.
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
 * A `d1` subcommand followed by the database NAME, in either spelling.
 *
 * Two forms, because both appear: the literal `dustinedwards`, and the
 * `${DB_NAME}` interpolation that several scripts bind to the same string. A
 * needle for the literal alone would miss every one of the second kind, which
 * is the "resolve bindings, not spellings" discipline.
 *
 * `d1 list` cannot match: it takes no database argument, so there is no name
 * after it. `d1 migrations` is excluded by name below rather than by hoping.
 */
/*
 * THE WORD BOUNDARY GOES INSIDE THE FIRST ALTERNATIVE, NOT AFTER THE GROUP.
 *
 * It was `(?:dustinedwards|\$\{DB_NAME\})\b`, and that trailing `\b` can never
 * match the second alternative: `}` is a non-word character and the next
 * character is a space, so there is no boundary between them. The needle
 * therefore saw the literal spelling and was BLIND to every `${DB_NAME}` site,
 * which is most of them. It reported 3 sites where there are 11, and one
 * violation where there are nine, and read as a nearly clean repo.
 *
 * Caught by counting the sites and disbelieving the number, which is the whole
 * reason the count is printed rather than just the violations.
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
  // `preserveLines`, because a reported line number that does not match the
  // file is worse than none: it sends the reader to the wrong place with
  // confidence. Without it the stripper collapses comment lines and every
  // number below is short by the length of the docblocks above the match.
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
       * `--local` ON THE SAME LINE is what makes the name correct. Read from
       * the line rather than the file, so a `--local` belonging to some other
       * command cannot license this one. That is the same rule the deploy
       * hook applies to `--dry-run`, and for the same reason.
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
 * THE SITES ARE COUNTED AND THE COUNT IS PRINTED, because "0 violations" and
 * "0 lines examined" are the same output otherwise. The floor below counts
 * ASSERTIONS, and every assertion here comes from a site, so a corpus with no
 * by-name sites at all would floor at the scope check alone. That is why the
 * scope assertion is separate and unconditional.
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
