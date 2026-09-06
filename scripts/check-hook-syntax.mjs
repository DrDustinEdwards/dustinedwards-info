/**
 * Gate: every hook PARSES, in both languages it is written in.
 *
 *   npm run check:hook-syntax
 *
 * ## Why this exists
 *
 * TWICE ON 2026-09-05 a hook was broken by an apostrophe. The checkers are
 * embedded in the shell script as SINGLE-QUOTED strings, so one apostrophe
 * inside the Python ends the string, hands the remainder of the program to bash
 * as commands, and the hook then refuses every call in the session with a shell
 * error. `no-direct-deploy.sh` carries the scar in a comment at its own line
 * 159.
 *
 * A broken hook fails in the WORST direction available. These are PreToolUse
 * guards: the session stops being able to work, or, when the breakage is in the
 * arm rather than the parser, the guard silently stops guarding. Neither is
 * visible to any other gate, because every other gate reads `app/`, `scripts/`
 * or `workers/`, and nothing reads `.claude/hooks/` as CODE. `check:hook-scope`
 * comes closest and is deliberately narrower: it replays ONE hook's decisions
 * and would not notice the other five failing to parse.
 *
 * ## WHAT IS ASSERTED
 *
 *   `bash -n` on every hook. Parse only, nothing executed.
 *   Every embedded Python checker string COMPILES, via `ast.parse`.
 *
 * Both interpreters are RESOLVED rather than named, through
 * `scripts/lib/bash.mjs` and `scripts/lib/python.mjs`. Measured 2026-09-05:
 * neither `bash` nor `python3` is on PATH in the PowerShell that runs `ship`,
 * and both are in the git bash a session runs. A gate naming either would be
 * green here and absent there.
 *
 * ## OBSERVATION BOUNDARY
 *
 * **PARSING IS NOT BEHAVING.** A hook that parses can still block the wrong
 * command, allow the right one, or read the wrong field off the payload.
 * `check:hook-scope` is the gate that drives real payloads through a real hook
 * and reads exit codes, and it covers ONE hook. The other five have their
 * syntax checked here and their behaviour checked nowhere, which is a real gap
 * and is stated rather than papered over.
 *
 * It also cannot see whether a hook is REGISTERED. `.claude/settings.json`
 * decides that, and hard rule 15 puts that file off limits to an agent, so an
 * unregistered hook parses cleanly here and protects nothing.
 *
 * FAILS CLOSED. No hooks found, no interpreter, or an unreadable file is a
 * failure, never a skip.
 */

import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { bashNotFoundMessage, resolveBash } from "./lib/bash.mjs";
import { compilePython, pythonNotFoundMessage, resolvePython } from "./lib/python.mjs";
import { assertFloor } from "./lib/floor.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOOKS_DIR = join(root, ".claude", "hooks");

console.log("\ncheck:hook-syntax\n");

let checks = 0;
let failures = 0;

/** @param {string} label @param {boolean} condition @param {string} [detail] */
function ok(label, condition, detail = "") {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

/* ---------------------------------------------------- the scope, asserted --- */

/** @type {string[]} */
let hookFiles = [];
try {
  hookFiles = readdirSync(HOOKS_DIR)
    .filter((name) => name.endsWith(".sh"))
    .sort();
} catch (error) {
  console.log(`  FAIL  the hooks directory could not be read at ${HOOKS_DIR}`);
  console.log(`        ${/** @type {Error} */ (error).message}`);
  console.log("        Every assertion below would pass by iterating nothing.\n");
  process.exit(1);
}

if (hookFiles.length === 0) {
  console.log(`  FAIL  no .sh hooks found under ${HOOKS_DIR}`);
  console.log("        A zero-scope scan reports what a clean sweep reports.\n");
  process.exit(1);
}

/* --------------------------------------------------- interpreters, first --- */

const BASH = resolveBash();
if (!BASH) {
  console.log(`  FAIL  ${bashNotFoundMessage()}`);
  console.log("");
  process.exit(1);
}
const BASH_PATH = BASH.path;

const PYTHON = resolvePython();
if (!PYTHON) {
  console.log(`  FAIL  ${pythonNotFoundMessage()}`);
  console.log("");
  process.exit(1);
}
const PYTHON_PATH = PYTHON.path;

console.log(`  bash:   ${BASH_PATH}  (${BASH.source})`);
console.log(`  python: ${PYTHON_PATH}`);
console.log(`  hooks:  ${hookFiles.length}\n`);

/* ------------------------------------------------------ 1. bash -n each ----- */

console.log("  1. every hook parses as shell");

for (const name of hookFiles) {
  const result = spawnSync(BASH_PATH, ["-n", join(HOOKS_DIR, name)], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) {
    ok(`${name} could be parsed at all`, false, `bash -n could not run: ${result.error.message}`);
    continue;
  }
  const detail = String(result.stderr ?? "").trim();
  ok(
    `${name} parses as shell`,
    result.status === 0,
    `bash -n exited ${result.status}. ${name} would fail at its first invocation, ` +
      `which for a PreToolUse hook means the session stops working or the guard ` +
      `stops guarding.\n        ${detail}`,
  );
}

/* ------------------------------- 2. the embedded Python, resolved not named -- */

/**
 * THE EXTRACTOR RESOLVES BINDINGS RATHER THAN SPELLINGS, hard rule 10.
 *
 * NOT ONE of these hooks contains the literal text `python3 -c`. Every one of
 * them probes three candidates into a variable and then calls `"$PY" -c`, so a
 * scan for the obvious spelling finds ZERO embedded checkers and, without the
 * floor below, reports a clean sweep of a file set it never opened.
 *
 * So the python-bearing tokens are HARVESTED from each file: the candidate loop
 * variable, anything assigned from it, and the bare interpreter names.
 *
 * @param {string} source
 * @returns {string[]} the token spellings that invoke Python in this file
 */
function pythonTokens(source) {
  const tokens = new Set(["python3", "python", "py"]);
  // `for cand in python3 python py; do`
  for (const match of source.matchAll(/\bfor\s+(\w+)\s+in\s+([^;\n]*\bpython\w*[^;\n]*);/g)) {
    tokens.add(`$${match[1]}`);
    tokens.add(`"$${match[1]}"`);
  }
  // `PY="$cand"`, binding a second name to the first
  for (const match of source.matchAll(/\b(\w+)="\$(\w+)"/g)) {
    if (tokens.has(`$${match[2]}`)) {
      tokens.add(`$${match[1]}`);
      tokens.add(`"$${match[1]}"`);
    }
  }
  return [...tokens];
}

/** @param {string} value */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Every `<python> -c '<source>'` in one file.
 *
 * The body is `[^']*` and that is EXACT rather than lazy: a POSIX single-quoted
 * string cannot contain an apostrophe, which is the entire reason the outage
 * happened. So this captures precisely what the shell would hand the
 * interpreter, including the truncation an apostrophe causes. A planted
 * apostrophe therefore surfaces here as Python that no longer parses, or at
 * `bash -n` above as an unterminated string, and both name the file.
 *
 * `after` is everything following the closing quote, which is what proves the
 * string ended where the shell thinks it did. See ALLOWED_AFTER.
 *
 * @param {string} source
 * @returns {{ code: string, after: string }[]}
 */
function embeddedPython(source) {
  /** @type {{ code: string, after: string }[]} */
  const found = [];
  for (const token of pythonTokens(source)) {
    const pattern = new RegExp(`${escapeRegExp(token)}\\s+-c\\s+'([^']*)'`, "g");
    for (const match of source.matchAll(pattern)) {
      found.push({ code: match[1], after: source.slice(match.index + match[0].length) });
    }
  }
  return found;
}

/**
 * What may legitimately follow the closing quote of a `-c '...'` string.
 *
 * ## WHY COMPILING THE BODY IS NOT ENOUGH, and this was measured by a PLANT
 * ## THAT PASSED on 2026-09-05
 *
 * An apostrophe planted in a comment inside `no-em-dash.sh`'s checker read:
 *
 *     ti = d.get("tool_input") or {}  # the payload's tool_input, don't trust it
 *
 * The shell ends the single-quoted string at the apostrophe in `payload's`, so
 * the interpreter receives everything up to `# the payload`. That prefix is a
 * COMPLETE PYTHON PROGRAM whose last line is a comment, so `ast.parse` accepted
 * it. `bash -n` also exited 0, because the remaining apostrophes happened to
 * re-balance into syntactically valid, meaningless shell.
 *
 * So the hook was BROKEN in exactly the way that caused two outages, and both
 * assertions passed. The truncation is invisible from either end alone: the
 * body parses, the file parses, and only the JOIN between them is wrong.
 *
 * What catches it is asking where the string ENDED. A `-c '...'` in these hooks
 * is always followed by a command substitution's `)`, a redirection, a pipe, a
 * separator, or end of line. It is never followed by a bare word, because a
 * bare word there is the remainder of a Python program that the shell has
 * started reading as arguments.
 */
const ALLOWED_AFTER = /^[ \t]*(\)|\||;|&|2>|>|<|#|$)/;

console.log("\n  2. every embedded Python checker compiles");

let compiled = 0;
let hooksWithPython = 0;

for (const name of hookFiles) {
  let source;
  try {
    source = readFileSync(join(HOOKS_DIR, name), "utf8");
  } catch (error) {
    ok(`${name} is readable`, false, /** @type {Error} */ (error).message);
    continue;
  }
  const strings = embeddedPython(source);
  if (strings.length > 0) hooksWithPython += 1;
  for (const [index, { code, after }] of strings.entries()) {
    const result = compilePython(PYTHON_PATH, code);
    compiled += 1;
    ok(
      `${name} embedded Python #${index + 1} compiles`,
      result.ok,
      result.ok
        ? ""
        : `ast.parse refused it. An apostrophe inside the single-quoted string ends ` +
          `it early and hands the rest of the program to bash; this has happened ` +
          `twice.\n        ${"error" in result ? result.error : ""}`,
    );
    /*
     * AND THE STRING ENDED WHERE IT SHOULD. See ALLOWED_AFTER: the body
     * compiling proves only that the PREFIX is valid Python, and a truncation
     * landing in a comment produces a valid prefix.
     */
    const tail = after.split("\n")[0];
    ok(
      `${name} embedded Python #${index + 1} ends where the shell thinks it does`,
      ALLOWED_AFTER.test(tail),
      `the closing quote is followed by ${JSON.stringify(tail.slice(0, 48))}, which is ` +
        `a bare word rather than a shell continuation. An apostrophe inside the ` +
        `single-quoted string ended it early, so the interpreter receives a TRUNCATED ` +
        `program and the shell receives the rest of it as commands. The truncated ` +
        `prefix can still compile, which is why this assertion exists alongside the one above.`,
    );
  }
}

console.log(`\n  ${hooksWithPython} hook(s) carry Python, ${compiled} string(s) compiled\n`);

/* ------------------------------------------------------------- the floors --- */

/*
 * TWO FLOORS, because the two scopes fail independently.
 *
 * The hook count catches a directory that stopped being read. The Python count
 * catches an extractor that stopped matching, which is the likelier failure:
 * the tokens are harvested by regex from shell source, and a hook rewritten to
 * call its interpreter a fourth way would silently contribute nothing.
 *
 * MEASURED 2026-09-05 by RUNNING this gate: 6 hooks, 10 Python strings (five
 * hooks carry a probe and a checker; stop-typecheck.sh carries neither).
 */
const MINIMUM_HOOKS = 6;
const MINIMUM_PYTHON_STRINGS = 10;

const hookBreach = assertFloor("check:hook-syntax", "hooks", hookFiles.length, MINIMUM_HOOKS);
if (hookBreach) {
  ok(
    "this gate read the hook directory",
    false,
    `${hookBreach} A hook that stopped being scanned is a guard nothing checks.`,
  );
}

const pythonBreach = assertFloor(
  "check:hook-syntax",
  "python-strings",
  compiled,
  MINIMUM_PYTHON_STRINGS,
);
if (pythonBreach) {
  ok(
    "this gate extracted the embedded checkers",
    false,
    `${pythonBreach} The extractor resolves bindings rather than spellings; a hook ` +
      `calling its interpreter a new way would go unread.`,
  );
}

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`${checks} checks, 0 failures\n`);
