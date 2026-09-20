/**
 * Gate: every hook PARSES, in both languages it is written in.
 *
 *   npm run check:hook-syntax
 *
 * BOUNDARY: **PARSING IS NOT BEHAVING.** A hook that parses can still block the wrong command,
 * allow the right one, or read the wrong field off the payload, and it cannot see whether a hook
 * is REGISTERED, which hard rule 15 puts off limits to an agent.
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

/* the scope, asserted */

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

/* interpreters, first */

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

/* 1. bash -n each */

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

/* 2. the embedded Python, resolved not named */

/**
 * THE EXTRACTOR RESOLVES BINDINGS RATHER THAN SPELLINGS, hard rule 10. NOT ONE of these hooks
 * contains the obvious literal: every one probes candidates into a variable and calls through it,
 * so a scan for the spelling finds ZERO embedded checkers and reports a clean sweep.
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
 * Every embedded checker in one file. The body pattern is EXACT rather than lazy: a POSIX
 * single-quoted string cannot contain an apostrophe, so this captures precisely what the shell
 * would hand the interpreter, truncation included. `after` is what follows the closing quote,
 * which is what proves the string ended where the shell thinks it did.
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
 * What may legitimately follow the closing quote.
 *
 * WHY COMPILING THE BODY IS NOT ENOUGH, AND THIS WAS MEASURED BY A PLANT THAT PASSED. An
 * apostrophe planted inside a comment ends the quoted string early, so the interpreter receives
 * only the prefix; that prefix was a COMPLETE PROGRAM whose last line was a comment, so the
 * compile accepted it, and the shell check also exited 0 because the remaining apostrophes
 * re-balanced into valid, meaningless shell. So the hook was BROKEN in exactly the way that caused
 * two outages and both assertions passed: the truncation is invisible from either end alone, and
 * only the JOIN between them is wrong.
 *
 * What catches it is asking where the string ENDED: one of these is never followed by a bare word,
 * because a bare word there is the remainder of a program the shell reads as arguments.
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
    /* AND THE STRING ENDED WHERE IT SHOULD: the body compiling proves only the PREFIX is valid. */
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

/* the floors */

/*
 * TWO FLOORS, the scopes failing independently. The hook count catches a directory that stopped
 * being read; the token count catches an extractor that stopped matching, which is likelier, a
 * hook rewritten to call its interpreter a fourth way contributing nothing.
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
