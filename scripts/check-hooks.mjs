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
 */
const EXPECTED_HOOKS = [
  { matcher: "Write|Edit", script: "no-em-dash.sh", guards: "em and en dashes in written content" },
  { matcher: "Bash", script: "scoped-git-add.sh", guards: "unscoped git add" },
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

for (const expected of EXPECTED_HOOKS) {
  const entry = preToolUse.find((/** @type {any} */ e) => e?.matcher === expected.matcher);
  const label = `PreToolUse ${expected.matcher}`;

  ok(
    `${label}: the matcher is declared`,
    Boolean(entry),
    `nothing matches ${JSON.stringify(expected.matcher)}, so ${expected.guards} is UNGUARDED. ` +
      `Declared matchers: ${preToolUse.map((/** @type {any} */ e) => JSON.stringify(e?.matcher)).join(", ") || "(none)"}`,
  );
  if (!entry) continue;

  const hooks = entry.hooks ?? [];
  ok(
    `${label}: carries exactly one command hook`,
    hooks.length === 1 && hooks[0]?.type === "command",
    `${hooks.length} hook(s), first type ${JSON.stringify(hooks[0]?.type ?? null)}`,
  );

  const command = commandOf(entry);
  // The BINDING. Existence alone would pass with the two commands swapped.
  ok(
    `${label}: runs ${expected.script}, so ${expected.guards} is what it guards`,
    command.includes(expected.script),
    `its command is ${JSON.stringify(command)}, which does not name ${expected.script}`,
  );

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

const stopCommand = stopCommands[0] ?? "";

ok(
  `the Stop hook invokes the repo's own ${TYPECHECK_SCRIPT} script`,
  new RegExp(`npm\\s+run\\s+(?:-s\\s+)?${TYPECHECK_SCRIPT}\\b`).test(stopCommand),
  `its command is ${JSON.stringify(stopCommand)}. It must run ` +
    `\`npm run -s ${TYPECHECK_SCRIPT}\` so that package.json stays the one place ` +
    `that defines what a typecheck is.`,
);

for (const fragment of fragments) {
  ok(
    `the Stop hook does not restate the ${TYPECHECK_SCRIPT} fragment: ${fragment}`,
    !stopCommand.includes(fragment),
    `the Stop command ${JSON.stringify(stopCommand)} contains ${JSON.stringify(fragment)} ` +
      `verbatim. That is a MIRROR of package.json, and mirrors drift: this one ran ` +
      `only the last fragment and typechecked against stale generated types.`,
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
