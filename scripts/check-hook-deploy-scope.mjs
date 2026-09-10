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
 * THREE CASES ARE PAIRED WITH A CONTROL and are read together: a dry run allowed
 * beside the same deploy still refused; a SELECT ending in a semicolon allowed
 * beside an UPDATE still blocked; a tilde path resolved beside an unresolvable
 * variable still failing closed. Each loosening alone would pass on a hook that
 * had simply stopped checking, which is the failure a loosening introduces and
 * the one that is silent.
 *
 * FAILS CLOSED. An unreadable hook, a missing interpreter or an unexpected exit
 * code is a failure, never a skip.
 *
 * ## THE INTERPRETER IS RESOLVED, NOT NAMED
 *
 * This spawned `bash` by bare name until 2026-09-05, which made it a gate that
 * depended on the shell it was written in: green in every Claude Code session,
 * because that harness runs git bash, and `spawnSync bash ENOENT` six times over
 * at `npm run ship` step 4, because ship runs from PowerShell where `bash` is
 * not on PATH. `scripts/lib/bash.mjs` finds a bash once and PROVES it runs; a
 * machine with none fails here, in one line, before any case is read.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { bashNotFoundMessage, resolveBash } from "./lib/bash.mjs";
import { assertFloor } from "./lib/floor.mjs";

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

/*
 * RESOLVED BEFORE THE FIRST CASE, and a failure is ONE line.
 *
 * The order matters as much as the resolution. Resolving inside `runHook` would
 * report a missing interpreter once per case, which is what the ENOENT run
 * looked like: six failures describing the same single fact, none of which named
 * it. This is a precondition of the gate, so it is stated where preconditions
 * are, next to the missing-hook check and in the same voice.
 */
const BASH = resolveBash();
if (!BASH) {
  console.log(`  FAIL  ${bashNotFoundMessage()}`);
  console.log("");
  process.exit(1);
}
/*
 * The path is bound to its own const rather than read off `BASH` at the call
 * site. `runHook` is a hoisted function declaration, so the compiler cannot
 * carry the null check above into a body that could in principle run before it,
 * and a non-null assertion there would be the check written twice with only one
 * of them enforced.
 */
const BASH_PATH = BASH.path;
console.log(`  bash: ${BASH_PATH}  (${BASH.source})\n`);

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
  const result = spawnSync(BASH_PATH, [HOOK], {
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
 * THE THIRTEEN CASES, and each one names the defect it would catch.
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
  {
    label: "wrangler deploy --dry-run INSIDE the site repo is allowed",
    command: "npx wrangler deploy --dry-run --outdir ./out",
    cwd: root,
    expect: 0,
    why:
      "ruled 2026-09-06. A dry run bundles and prints: no version, no " +
      "deployment, nothing changed on the account. Blocking it cost a " +
      "dependency session its module measurement and pushed that measurement " +
      "outside the guard, which is the worse habit.",
  },
  {
    label: "a real deploy BESIDE a dry run is still blocked",
    /*
     * THE PAIR IS THE ASSERTION. The case above alone would pass on a hook
     * that had simply stopped blocking deploys, which is the failure the
     * loosening could introduce and the one that is silent. This is the same
     * command with the flag removed, so the two differ in exactly the thing
     * under test and nothing else.
     */
    command: "npx wrangler deploy --outdir ./out",
    cwd: root,
    expect: 2,
    why:
      "without --dry-run this is the act hard rule 16 reserves to ship. If " +
      "this allows, the flag check is matching something other than the flag.",
  },
  {
    label: "a d1 SELECT whose SQL ends in a semicolon is allowed",
    /*
     * THE SEMICOLON IS THE WHOLE CASE. The hook cuts each wrangler invocation
     * out of the command with a segment regex, and that regex stopped at the
     * first `;` ANYWHERE, including one inside the quoted SQL. The tail then
     * held an unterminated quote, no `--command` could be read off it, and the
     * arm exited 9: "SQL this check cannot read". A read was refused for
     * ending the way SQL normally ends.
     *
     * The split on `;` inside the SQL was never the problem and is unchanged;
     * it already skips the empty trailing statement.
     */
    command: `npx wrangler d1 execute dustinedwards --remote --command "SELECT count(*) FROM posts;"`,
    cwd: root,
    expect: 0,
    why:
      "a read is allowed, and a trailing semicolon is not a second statement. " +
      "If this blocks, the segment regex is splitting inside a quoted string.",
  },
  {
    label: "a d1 UPDATE ending in a semicolon is STILL blocked",
    /*
     * THE PAIR, on the dry-run pair's grounds. The case above alone would pass
     * on a hook that had simply stopped reading d1 statements at all, which is
     * exactly what a widened segment regex could cause and is the silent
     * direction. Same shape, same semicolon, one verb different.
     */
    command: `npx wrangler d1 execute dustinedwards --remote --command "UPDATE posts SET title = 'x';"`,
    cwd: root,
    expect: 2,
    why:
      "hard rule 18: D1 is derived and is repaired through its derivation, " +
      "never by a hand-written statement. If this allows, widening the segment " +
      "regex has cost the guard the write it exists to refuse.",
  },
  {
    label: "wrangler d1 execute --help is allowed",
    /*
     * USAGE TEXT IS NOT A STATEMENT. It carries no SQL, which is precisely why
     * it hit the unverifiable arm and exited 9. Same class as --dry-run above
     * and ruled on the same grounds: refusing a read is the safe direction and
     * is still wrong, because the workaround is a session running d1 commands
     * outside the guard.
     */
    command: "npx wrangler d1 execute --help",
    cwd: root,
    expect: 0,
    why:
      "printing usage changes nothing. If this blocks, a session learning the " +
      "command has to leave the guarded directory to read its own help text.",
  },
  {
    label: "a tilde path is expanded, so a deploy at home is allowed",
    /*
     * `cd ~` USED TO BE UNRESOLVABLE. The hook returned None for it, the caller
     * reads None as INSIDE this repo, and a deploy anywhere reachable only by a
     * tilde was refused for a rule that has nothing to say about it. That is
     * ruling 20 again, one spelling of the path along.
     *
     * HOME, NOT A SIBLING PATH, deliberately: it is somewhere this gate can
     * name from any clone without assuming where the checkout sits relative to
     * it. The sibling case above already covers the relative form.
     */
    command: "cd ~ && npm run deploy",
    cwd: root,
    expect: 0,
    why:
      "home is not this repo, so hard rule 16 does not reach it. If this " +
      "blocks, expanduser is not being applied before the comparison.",
  },
  {
    label: "an UNRESOLVABLE variable still fails closed",
    /*
     * THE PAIR FOR THE TILDE CASE, and it is the one that matters. Accepting
     * `$` and `%` is a loosening, and the unsafe way to implement it is to let
     * an unresolved `$NOPE` normalise into a path that is not this repo, read
     * as OUTSIDE, and unblock a deploy. Expanding first and testing the RESULT
     * is what prevents that, and this is what proves it.
     */
    command: "cd $DUSTINEDWARDS_NO_SUCH_VARIABLE/x && npm run deploy",
    cwd: root,
    expect: 2,
    why:
      "an unresolved variable leaves the directory unknown, and unknown must " +
      "read as inside. If this allows, the guard has a bypass that is one " +
      "undefined environment variable wide.",
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
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-09-06 by RUNNING it: 8.
 * It was 6, before the dry-run pair landed with the 2026-09-06 loosening.
 * Slack of zero, because the set is a fixed enumeration of the ruling's own
 * cases and a drop is a removed case rather than natural movement.
 */
const MINIMUM_CHECKS = 13;
const floorBreach = assertFloor(
  "check:hook-scope",
  "checks",
  checks,
  MINIMUM_CHECKS,
  "The case set is a fixed enumeration of ruling 20's own cases, so the slack is " +
    "ZERO by design and a drop is a removed case rather than natural movement.",
);
if (floorBreach) ok("this gate executed its cases", false, floorBreach);

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`  ${checks} case(s) replayed against the real hook, both directions\n`);
console.log(`${checks} checks, 0 failures\n`);
