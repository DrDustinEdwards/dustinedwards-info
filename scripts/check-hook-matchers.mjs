/**
 * Gate: no tool that can reach a guarded act is missing from the hook matchers.
 *
 *   npm run check:hook-matchers
 *
 * BOUNDARY, AND IT IS THE IMPORTANT HALF: **THE HARNESS TOOL LIST IS NOT IN THIS REPO**, so the
 * assertion a reader actually wants is not statically decidable here. What is on disk is the
 * permission allow list, and a tool used under one-off approvals writes no rule at all.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assertFloor } from "./lib/floor.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLAUDE_DIR = join(root, ".claude");
const HOOKS_DIR = join(CLAUDE_DIR, "hooks");
const SETTINGS = join(CLAUDE_DIR, "settings.json");
const LOCAL_SETTINGS = join(CLAUDE_DIR, "settings.local.json");

console.log("\ncheck:hook-matchers\n");

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

/**
 * TOOLS THAT EXECUTE A COMMAND STRING. Each must appear in EVERY PreToolUse matcher registered
 * here, because every hook reads the command and none reads the tool name.
 *
 * @type {Record<string, string>}
 */
const COMMAND_TOOLS = {
  Bash: "runs a shell command string.",
  PowerShell: "runs a command string through powershell.exe, added 2026-09-15.",
};

/**
 * TOOLS THAT WRITE FILE CONTENT. These must appear in the matcher registering
 * no-em-dash.sh, which reads `content` and `new_string` as well as `command`.
 *
 * @type {Record<string, string>}
 */
const CONTENT_TOOLS = {
  Write: "writes a whole file.",
  Edit: "replaces a string inside a file.",
  NotebookEdit: "writes a notebook cell, which is file content by another name.",
};

/**
 * TOOLS THAT NEED NO MATCHER, enumerated rather than defaulted. AN EXCLUSION NAMING A TOOL
 * EXCLUDES EVERYTHING IT CAN DO, which is rule 10's discipline about enumerating inside
 * exclusions, so each carries the reason it cannot reach a guarded act.
 *
 * @type {Record<string, string>}
 */
const UNGUARDED_TOOLS = {
  Read: "reads a file and writes nothing.",
  Glob: "matches paths and writes nothing.",
  Grep: "searches content and writes nothing.",
  WebFetch: "fetches a URL; it cannot write the tree or run a command.",
  WebSearch: "searches the web; same reason.",
  Artifact: "publishes a page from a file already written through Write or Edit.",
};

/**
 * The names asserted present whether or not a permission rule still mentions them: a tool used
 * under one-off approvals leaves no rule behind, and a rule deleted in a tidy-up must not delete
 * the requirement with it.
 */
const REQUIRED_FLOOR = ["Bash", "PowerShell"];

/**
 * The same floor for the dash matcher, and here it is the ONLY thing asserting anything: those
 * tools appear in no allow list and never will, being permitted by default. A content half built
 * purely on observation asserts NOTHING while reporting a clean sweep.
 */
const DASH_FLOOR = ["Write", "Edit"];

if (!existsSync(SETTINGS)) {
  console.log(`  FAIL  the settings file is missing at ${SETTINGS}`);
  console.log("        Every assertion below would pass by reading nothing.\n");
  process.exit(1);
}

/** @param {string} path */
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    console.log(`  FAIL  ${path} is not readable as JSON: ${String(error)}`);
    console.log("        Failing closed rather than treating it as empty.\n");
    process.exit(1);
  }
}

const settings = readJson(SETTINGS);
const hasLocal = existsSync(LOCAL_SETTINGS);
const local = hasLocal ? readJson(LOCAL_SETTINGS) : null;

console.log(`  settings:       ${SETTINGS.slice(root.length + 1)}`);
console.log(
  `  local settings: ${
    hasLocal ? LOCAL_SETTINGS.slice(root.length + 1) : "ABSENT (a clean checkout, so the tracked half only)"
  }\n`,
);

/*
 * 1. REGISTRATION, both directions. This is the gap `check:hook-syntax` names and cannot close:
 * it compiles what it finds in the directory, so an unregistered hook compiles cleanly and guards
 * nothing, and a drifted path takes a guard out while leaving its file to be read and believed.
 */
console.log("  1. every hook is registered and every registration resolves\n");

/**
 * ONE SHAPE FOR A HOOK ENTRY, declared rather than inferred: parsing JSON returns `any`.
 *
 * @typedef {{ matcher?: string, hooks?: Array<{ command?: string }> }} HookEntry
 */

const declaredHooks = /** @type {{ hooks?: Record<string, HookEntry[]> }} */ (settings).hooks ?? {};
const preToolUse = Array.isArray(declaredHooks.PreToolUse) ? declaredHooks.PreToolUse : [];
const otherEvents = Object.entries(declaredHooks)
  .filter(([event]) => event !== "PreToolUse")
  .flatMap(([, entries]) => (Array.isArray(entries) ? entries : []));

const allEntries = [...preToolUse, ...otherEvents];
const registeredCommands = allEntries.flatMap((entry) =>
  (entry.hooks ?? []).map((hook) => String(hook.command ?? "")),
);

ok(
  "at least one PreToolUse matcher is declared",
  preToolUse.length > 0,
  "no PreToolUse entry was parsed, so every matcher assertion below would " +
    "compare against an empty set and report a clean sweep.",
);

const hookFiles = existsSync(HOOKS_DIR)
  ? readdirSync(HOOKS_DIR).filter((name) => name.endsWith(".sh"))
  : [];

ok(
  "the hooks directory is non-empty",
  hookFiles.length > 0,
  `no .sh files under ${HOOKS_DIR}. A zero-scope search reports what a clean sweep reports.`,
);

for (const file of hookFiles) {
  ok(
    `${file} is registered in settings.json`,
    registeredCommands.some((command) => command.includes(file)),
    "the file is on disk and nothing invokes it, so it reads as a guard and is " +
      "not one. Register it, or delete it.",
  );
}

for (const command of registeredCommands) {
  const named = hookFiles.filter((file) => command.includes(file));
  ok(
    `a registered command resolves to a hook on disk: ${command.slice(-40)}`,
    named.length > 0,
    "the registration names no file in .claude/hooks/. A path that has drifted " +
      "disables the guard silently: the hook file is still there to be read.",
  );
}

/*
 * 2. THE MATCHERS AGAINST THE PERMISSION ALLOW LISTS. The tool names come from the allow rules, a
 * different file in one case and a different SECTION in the other, so the expected set is not
 * produced by the thing being checked, which is what rule 10 means by fixture independence.
 */
console.log("\n  2. every tool that can reach a guarded act is in the matchers\n");

/** @param {unknown} value @returns {string[]} */
function allowRules(value) {
  const rules = /** @type {{ permissions?: { allow?: unknown } }} */ (value)?.permissions?.allow;
  return Array.isArray(rules) ? rules.map(String) : [];
}

const rules = [...allowRules(settings), ...(local ? allowRules(local) : [])];

/*
 * THE TOOL NAME IS THE PREFIX BEFORE THE PAREN, and a rule with no paren is the whole name. MCP
 * rules are dropped: such a tool cannot reach this tree or this shell.
 */
const observed = [
  ...new Set(
    rules
      .map((rule) => {
        const match = rule.match(/^([A-Za-z_][A-Za-z0-9_]*)\(/);
        return match ? match[1] : rule;
      })
      .filter((name) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
      .filter((name) => !name.startsWith("mcp__")),
  ),
].sort();

ok(
  "the allow lists parsed to a non-empty set of tool names",
  observed.length > 0,
  `${rules.length} rule(s) read and no tool name extracted. The prefix matcher ` +
    "has broken, and an empty set satisfies every assertion below.",
);

const unclassified = observed.filter(
  (name) => !COMMAND_TOOLS[name] && !CONTENT_TOOLS[name] && !UNGUARDED_TOOLS[name],
);

for (const name of unclassified) {
  ok(
    `the tool ${name} is classified in this gate`,
    false,
    `${name} appears in a permissions allow list and this gate has never been ` +
      "told what it can do. Add it to COMMAND_TOOLS (it runs a command string), " +
      "CONTENT_TOOLS (it writes file content), or UNGUARDED_TOOLS (it can do " +
      "neither, with the reason). This is the defect the gate exists for: a new " +
      "tool name arriving and nothing noticing.",
  );
}

const matchers = preToolUse.map((entry) => String(entry.matcher ?? ""));
/** @param {string} matcher @returns {string[]} */
function matcherNames(matcher) {
  return matcher.split("|").map((part) => part.trim());
}

const required = [...new Set([...REQUIRED_FLOOR, ...observed.filter((name) => COMMAND_TOOLS[name])])].sort();

for (const [index, matcher] of matchers.entries()) {
  const names = matcherNames(matcher);
  const hooksHere = (preToolUse[index]?.hooks ?? [])
    .map((hook) =>
      String(hook.command ?? "")
        .split(/[\\/]/)
        .pop()
        ?.replace(/["']+$/, ""),
    )
    .join(", ");
  for (const tool of required) {
    ok(
      `matcher ${index + 1} (${hooksHere}) names ${tool}`,
      names.includes(tool),
      `the matcher is "${matcher}" and ${tool} ${
        COMMAND_TOOLS[tool] ?? "runs a command string."
      } A hook behind this matcher cannot fire on a ${tool} call, and not one ` +
        "hook here reads tool_name, so the matcher is the only thing deciding.",
    );
  }
}

/*
 * THE CONTENT TOOLS, against the matcher that registers the dash hook: demanding them on the
 * shell-only group is a false requirement somebody eventually satisfies by widening the wrong
 * matcher.
 */
const dashMatchers = preToolUse.filter((entry) =>
  (entry.hooks ?? []).some((hook) => String(hook.command ?? "").includes("no-em-dash.sh")),
);

ok(
  "the dash hook is registered under exactly one matcher",
  dashMatchers.length === 1,
  `found ${dashMatchers.length}. The assertion below reads the first one, so ` +
    "zero would check nothing and two would leave one unchecked.",
);

const contentRequired = [
  ...new Set([...DASH_FLOOR, ...observed.filter((name) => CONTENT_TOOLS[name])]),
].sort();
for (const tool of contentRequired) {
  const names = matcherNames(String(dashMatchers[0]?.matcher ?? ""));
  ok(
    `the dash matcher names ${tool}`,
    names.includes(tool),
    `${tool} ${CONTENT_TOOLS[tool]} It is in a permissions allow list, so it can ` +
      "write an em dash into the tree without passing the dash hook. ef6be97 " +
      "fixed exactly this for Write and Edit on 2026-08-14.",
  );
}

console.log("");
console.log(`  tools observed in the allow lists: ${observed.join(", ")}`);
console.log(`  required in every matcher:         ${required.join(", ")}`);
console.log(
  `  content tools required:            ${contentRequired.join(", ")}`,
);
console.log("");

/*
 * EXECUTED-COUNT FLOOR, one name per branch, MEASURED BY RUNNING IT BOTH WAYS. THE TWO ARE EQUAL
 * TODAY AND THE SPLIT IS STILL RIGHT: the moment a new COMMAND tool is granted locally, that
 * branch gains an assertion per matcher and the other gains none.
 */
const MINIMUM_LOCAL = 22;
const MINIMUM_TRACKED = 22;
const floorBreach = assertFloor(
  "check:hook-matchers",
  hasLocal ? "checks-local" : "checks-tracked",
  checks,
  hasLocal ? MINIMUM_LOCAL : MINIMUM_TRACKED,
  "The branches are floored separately because the local settings file is " +
    "gitignored, so a checkout reads fewer rules and would otherwise be judged " +
    "against a floor measured on a machine that has it.",
);
if (floorBreach) ok("this gate executed its assertions", false, floorBreach);

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`${checks} checks, 0 failures\n`);
