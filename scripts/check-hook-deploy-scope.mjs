/**
 * Gate: `no-direct-deploy.sh` blocks a deploy HERE and allows one elsewhere.
 *
 *   npm run check:hook-scope
 *
 * ## Why this exists
 *
 * The hook was scoped to the site repo on 2026-09-05 (ruling 20) after it
 * refused `cd ../dustinedwards-mcp && npm run deploy`, a command hard rule 16
 * has nothing to say about. A scope change to a guard is the most dangerous
 * kind of edit there is: the failure it introduces is SILENT and in the
 * permissive direction, and the only symptom is a deploy that should have been
 * refused going through.
 *
 * So both directions are replayed. `check:hooks` was deleted once as vacuous;
 * this is not that, because every case below drives the REAL hook file with a
 * REAL payload and reads its exit code, rather than asserting that some prose
 * about the hook is present.
 *
 * ## OBSERVATION BOUNDARY
 *
 * It runs the hook the way the harness does: the payload on stdin, exit 2 for
 * a block and 0 for an allow. It does NOT prove the harness invokes the hook at
 * all, which is `.claude/settings.json`'s business and is asserted there by the
 * file existing in the matcher list. A hook unregistered in settings would pass
 * every case here and protect nothing.
 *
 * FAILS CLOSED. An unreadable hook, a missing interpreter or an unexpected exit
 * code is a failure, never a skip.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOOK = join(root, ".claude", "hooks", "no-direct-deploy.sh");

console.log("\ncheck:hook-scope\n");

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

if (!existsSync(HOOK)) {
  console.log(`  FAIL  the hook is missing at ${HOOK}`);
  console.log("        Every case below would pass by running nothing.\n");
  process.exit(1);
}

/**
 * Run the hook against one command, from one working directory.
 *
 * `cwd` is what the PreToolUse payload carries: the SESSION's directory, not
 * the command's. The command's own `cd` is what moves it, which is the whole
 * subject of this gate.
 *
 * @param {string} command
 * @param {string} cwd
 * @returns {number} the hook's exit code: 2 blocks, 0 allows
 */
function runHook(command, cwd) {
  const payload = JSON.stringify({ cwd, tool_input: { command } });
  const result = spawnSync("bash", [HOOK], {
    input: payload,
    encoding: "utf8",
    cwd: root,
  });
  if (result.error) {
    console.log(`  FAIL  the hook could not be run: ${result.error.message}`);
    failures += 1;
    return -1;
  }
  return result.status ?? -1;
}

/*
 * THE SIX CASES, and each one names the defect it would catch.
 *
 * The parent directory is derived rather than written, so this reads correctly
 * from any clone path. `../dustinedwards-mcp` is a real sibling on the machine
 * that runs the deploy, and the hook resolves it whether or not it exists,
 * which is correct: a deploy into a directory that is not there fails at the
 * shell rather than at this guard.
 */
const CASES = [
  {
    label: "npm run deploy INSIDE the site repo is blocked",
    command: "npm run deploy",
    cwd: root,
    expect: 2,
    why:
      "hard rule 16: ship is the only reproducible deploy of this Worker. If " +
      "this allows, the scope check has swallowed the case it was built around.",
  },
  {
    label: "npm run deploy in a SIBLING repo is allowed",
    command: "cd ../dustinedwards-mcp && npm run deploy",
    cwd: root,
    expect: 0,
    why:
      "ruling 20. The admin MCP has no ship pipeline and deploys this way by " +
      "its own README; refusing it is a rule applied where it does not reach.",
  },
  {
    label: "the LAST cd wins, so cd out then back is blocked",
    /*
     * THE RETURN PATH IS DERIVED FROM THE CHECKOUT, not written out as
     * `dustinedwards-info`.
     *
     * CAUGHT BY `check:head` ON THIS CASE'S FIRST RUN. That gate replays the
     * offline tier against a fresh checkout of HEAD in a temp directory, where
     * `cd ../dustinedwards-info` lands somewhere genuinely outside the repo, so
     * the hook correctly ALLOWED the deploy and this case failed. The hook was
     * right and the fixture was wrong.
     *
     * The case had been asserting something about the checkout's NAME rather
     * than about the behaviour under test: a fixture that holds only while the
     * world is arranged the way its author happened to find it. Deriving the
     * name is what makes it a statement about the last `cd` winning.
     */
    command: `cd ../dustinedwards-mcp && cd ../${basename(root)} && npm run deploy`,
    cwd: root,
    expect: 2,
    why:
      "a shell runs the command in the directory the last cd left it in. " +
      "Reading the first cd would let any deploy through by prefixing it.",
  },
  {
    label: "an ABSOLUTE path outside the repo is allowed",
    command: "cd /tmp/x && wrangler deploy",
    cwd: root,
    expect: 0,
    why:
      "the resolution must handle an absolute cd, not only a relative one. A " +
      "check that only understood `..` would block every absolute path.",
  },
  {
    label: "a d1 DELETE is still blocked from outside the repo",
    command:
      'cd ../dustinedwards-mcp && wrangler d1 execute dustinedwards --remote --command "DELETE FROM posts"',
    cwd: root,
    expect: 2,
    why:
      "THE D1 ARMS ARE GLOBAL BY DESIGN. Their subject is the database named " +
      "in the command's own argument, so it travels with the command rather " +
      "than with the directory. If this allows, the scope check leaked into " +
      "arms it was never meant to touch, which is the worst outcome here.",
  },
  {
    label: "a BARE cd is treated as inside, so the deploy is blocked",
    command: "cd && npm run deploy",
    cwd: root,
    expect: 2,
    why:
      "a bare cd goes home, which this cannot resolve. Everything unresolvable " +
      "must read as inside, or an unparseable command becomes a way through.",
  },
];

for (const { label, command, cwd, expect, why } of CASES) {
  const code = runHook(command, cwd);
  const verdict = expect === 2 ? "blocked" : "allowed";
  const got = code === 2 ? "blocked" : code === 0 ? "allowed" : `exit ${code}`;
  /*
   * EACH VERDICT IS PRINTED, not only the failures. A guard whose replay says
   * nothing when it passes is a replay nobody reads, and the whole value of
   * this gate is that somebody changing the hook can see both directions move.
   */
  console.log(`  ${got === verdict ? "ok  " : "FAIL"}  ${got.padEnd(7)} ${command}`);
  ok(
    label,
    code === expect,
    `expected ${verdict} (exit ${expect}), got ${got}.\n        ${why}\n` +
      `        command: ${command}`,
  );
}
console.log("");

/*
 * EXECUTED-COUNT FLOOR. Every case above comes from one array, which is exactly
 * the shape that fails quietly: an array that stopped parsing would run zero
 * cases and report a clean sweep of a security guard.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-09-05 by RUNNING it: 6.
 * Slack of zero, because the set is a fixed enumeration of the ruling's own
 * cases and a drop is a removed case rather than natural movement.
 */
const MINIMUM_CHECKS = 6;
if (checks < MINIMUM_CHECKS) {
  ok(
    "this gate executed its cases",
    false,
    `only ${checks} ran, expected ${MINIMUM_CHECKS}. A block was SKIPPED rather ` +
      `than failing. Measured: 6.`,
  );
}

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`  ${checks} case(s) replayed against the real hook, both directions\n`);
console.log(`${checks} checks, 0 failures\n`);
