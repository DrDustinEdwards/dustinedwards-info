/**
 * Gate: no tool that can reach a guarded act is missing from the hook matchers.
 *
 *   npm run check:hook-matchers
 *
 * ## Why this exists, 2026-09-15
 *
 * A PreToolUse matcher is a regex over the TOOL NAME. The matchers here read
 * `Write|Edit|Bash` and `Bash` until today, and the agent's PowerShell tool
 * reports the name `PowerShell`, which matches neither. Every hook in this
 * directory fired on Bash calls and on nothing else, while the session held
 * pre-approved `PowerShell(npm run *)` and `PowerShell(git *)` permission
 * rules. So `npm run deploy` with no deploy door, an unscoped `git add` with no
 * scoped-add check, and a push with no lint were all reachable with no prompt
 * and no guard, for 59 days on the two oldest hooks.
 *
 * ef6be97 on 2026-08-14 had already fixed this once, one tool name earlier,
 * when the em dash hook matched only Write and Edit. A matcher ENUMERATES
 * tools, so it goes stale every time the harness gains one, and until this file
 * nothing in the repo read a matcher at all: check:hook-syntax parses the hooks
 * and says in its own header that it cannot see whether one is REGISTERED, and
 * check:hook-scope replays the deploy hook and says it cannot see whether the
 * harness invokes it. Both gaps end at this gate.
 *
 * ## OBSERVATION BOUNDARY, and it is the important half
 *
 * THE HARNESS TOOL LIST IS NOT IN THIS REPO. There is no manifest of the tools
 * a session can call, so the assertion a reader actually wants, every tool that
 * can execute a command string is in every matcher, is NOT statically decidable
 * here. Nothing in a checkout knows that a tool named PowerShell exists.
 *
 * What IS on disk is the PERMISSION ALLOW LIST, and that is what this gate
 * reads. A tool the session has been granted appears there by name, so the
 * matchers can be compared against a set derived from a DIFFERENT file than the
 * one under test, which is the fixture independence rule 10 asks for. That
 * comparison is exactly the desync that went unnoticed: the PowerShell rules
 * and the Bash-only matcher sat in the same directory for ten weeks.
 *
 * THE RESIDUAL, stated rather than hidden. A tool used under one-off approvals
 * writes no permission rule, so this gate cannot see it. The window it closes
 * is the one that actually happened, from ten weeks down to the next gate run,
 * and the window it leaves open is a tool nobody has ever granted. That is why
 * REQUIRED carries a hard floor as well: the names known to matter today are
 * asserted whether or not a permission rule still mentions them.
 *
 * ## FAILS CLOSED ON AN UNKNOWN TOOL
 *
 * Every tool name found in an allow list must be CLASSIFIED below. A name this
 * file has never been told about is a FAILURE, not a skip, and the message says
 * which bucket to put it in. That is the one direction that matters: the defect
 * this gate exists about was a new tool name arriving and nothing noticing, so
 * an unclassified name has to stop the tier rather than pass through it.
 *
 * ## TWO BRANCHES, because `settings.local.json` is gitignored
 *
 * The local file holds most of the interesting rules and is untracked, exactly
 * like `wrangler.jsonc` and for the same reason check:config cannot run in CI.
 * A checkout has no copy, so this gate runs the tracked half there and says so.
 * The two branches print DIFFERENT floor names, `checks-local` and
 * `checks-tracked`, so a floor measured under one is never read against the
 * other. check:invariants records that collision costing a silent pass.
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
 * TOOLS THAT EXECUTE A COMMAND STRING. Each one must appear in EVERY PreToolUse
 * matcher registered in this file, because every hook here reads
 * `tool_input.command` and none of them reads `tool_name`: a hook is blind to
 * which tool sent the command, so the matcher is the only thing deciding.
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
 * TOOLS THAT NEED NO MATCHER, enumerated rather than defaulted.
 *
 * AN EXCLUSION NAMING A TOOL EXCLUDES EVERYTHING IT CAN DO, which is rule 10's
 * discipline about enumerating inside exclusions, so each one carries the reason
 * it cannot reach a guarded act: it neither runs a command nor writes a file.
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
 * The names asserted present whether or not a permission rule still mentions
 * them. A hard floor, because the residual above is real: a tool used under
 * one-off approvals leaves no rule behind, and a rule deleted in a tidy-up must
 * not quietly delete the requirement with it.
 */
const REQUIRED_FLOOR = ["Bash", "PowerShell"];

/**
 * The same floor for the dash matcher, and here it is not a belt-and-braces
 * measure but the ONLY thing asserting anything.
 *
 * MEASURED 2026-09-15: Write and Edit appear in no allow list in this repo and
 * never will, because they are permitted by default and a rule is only written
 * for something that prompts. So the observed set can never demand them, and a
 * content half built purely on observation asserts NOTHING while reporting a
 * clean sweep. That is the unfailable-condition class from rule 10, found by
 * running this gate and reading "content tools checked: none observed".
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
 * 1. REGISTRATION. Every hook file on disk is registered, and every registered
 *    command points at a file that exists.
 *
 * This is the gap check:hook-syntax names in its own header and cannot close: it
 * compiles what it finds in the directory, so a hook nobody registered compiles
 * cleanly and guards nothing, and a registration whose path has drifted takes a
 * guard out while leaving its file in place to be read and believed.
 */
console.log("  1. every hook is registered and every registration resolves\n");

/**
 * ONE SHAPE FOR A HOOK ENTRY, declared rather than inferred.
 *
 * `JSON.parse` returns `any`, and the first draft read `entry?.hooks` through it
 * with an `Array.isArray` ternary whose other branch was `never[]`. Six implicit
 * `any` errors, caught by the Stop hook running `npm run typecheck` rather than
 * by anything here, which is the check:types half of rule 10: a gate script is
 * source like any other and an untyped read of parsed JSON is where it lands.
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
 * 2. THE MATCHERS AGAINST THE PERMISSION ALLOW LISTS.
 *
 * The tool names are taken from the allow rules, which are a different file
 * from the matchers in the local case and a different SECTION of the same file
 * in the tracked one. Either way the expected set is not produced by the thing
 * being checked, which is what rule 10 means by fixture independence.
 */
console.log("\n  2. every tool that can reach a guarded act is in the matchers\n");

/** @param {unknown} value @returns {string[]} */
function allowRules(value) {
  const rules = /** @type {{ permissions?: { allow?: unknown } }} */ (value)?.permissions?.allow;
  return Array.isArray(rules) ? rules.map(String) : [];
}

const rules = [...allowRules(settings), ...(local ? allowRules(local) : [])];

/*
 * THE TOOL NAME IS THE PREFIX BEFORE THE PAREN, and a rule with no paren is the
 * whole name. `mcp__server__tool` rules are dropped: an MCP tool runs on a
 * server and cannot reach this tree or this shell, and they would otherwise be
 * hundreds of names demanding classification.
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
 * THE CONTENT TOOLS, against the matcher that registers the dash hook rather
 * than against all of them. Asking every matcher for Write would demand it on
 * the shell-only group, which reads no file content and would be a false
 * requirement that somebody eventually satisfies by widening the wrong matcher.
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
 * EXECUTED-COUNT FLOOR, one name per branch.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-09-15 by RUNNING it both
 * ways: 22 with the local settings present, and 22 with the file moved aside,
 * which is how the second number was taken rather than by subtracting.
 *
 * THE TWO ARE EQUAL TODAY AND THE SPLIT IS STILL RIGHT. They are equal because
 * every tool the local file adds beyond the tracked one is either already in
 * the hard floor (PowerShell) or unguarded (Read, WebFetch), and an unguarded
 * tool asserts nothing. The moment a new COMMAND tool is granted in the local
 * file alone, the local branch gains one assertion per matcher and the tracked
 * branch gains none, so a single floor would then be measured on this machine
 * and read against CI. That is the collision check:invariants records costing a
 * silent pass, and it is cheaper to keep the names apart than to discover it
 * again.
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
