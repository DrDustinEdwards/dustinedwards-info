/**
 * Gate: the deploy hook blocks a deploy HERE and allows one elsewhere, which is hard rule 16's
 * ship contract seen from the hook's side.
 *
 *   npm run check:hook-scope
 *
 * BOUNDARY: every case drives the REAL hook with a REAL payload and reads its exit code, but it
 * does NOT prove the harness invokes the hook at all, which is the settings file's business.
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
 * RESOLVED BEFORE THE FIRST CASE, and a failure is ONE line: resolving inside the runner reported
 * six failures describing the same single fact, none of which named it.
 */
const BASH = resolveBash();
if (!BASH) {
  console.log(`  FAIL  ${bashNotFoundMessage()}`);
  console.log("");
  process.exit(1);
}
/*
 * The path is bound to its own const rather than read at the call site: the runner is hoisted, so
 * the compiler cannot carry the null check into it, and an assertion there would be the check
 * written twice with one of them enforced.
 */
const BASH_PATH = BASH.path;
console.log(`  bash: ${BASH_PATH}  (${BASH.source})\n`);

/**
 * Run the hook against one command, from one working directory. `cwd` is what the payload
 * carries: the SESSION's directory, not the command's, whose own `cd` is this gate's subject.
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
 * The cases, each naming the defect it would catch. The parent is DERIVED so this reads correctly
 * from any clone path, and the sibling resolves whether or not it exists.
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
     * THE RETURN PATH IS DERIVED FROM THE CHECKOUT: caught on its first run by the gate that replays
     * the tier against a fresh extraction, where the written name lands genuinely outside the repo, so
     * the hook correctly ALLOWED and the fixture was wrong. It had been asserting something about the
     * checkout's NAME rather than the behaviour under test.
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
     * THE PAIR IS THE ASSERTION: the case above alone would pass on a hook that had stopped blocking
     * deploys. Same command, flag removed, so the two differ in exactly the thing under test.
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
     * THE SEMICOLON IS THE WHOLE CASE: the segment regex stopped at the first `;` ANYWHERE, including
     * one inside the quoted SQL, so a read was refused for ending the way SQL normally ends.
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
     * THE PAIR: the case above alone would pass on a hook that had stopped reading these statements,
     * which is what a widened segment regex causes. Same shape, one verb different.
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
     * USAGE TEXT IS NOT A STATEMENT: it carries no SQL, so it hit the unverifiable arm. Refusing a
     * read is safe and still wrong, the workaround being a session running these outside the guard.
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
     * `cd ~` USED TO BE UNRESOLVABLE: the hook returned nothing, the caller reads nothing as INSIDE
     * this repo, and a deploy reachable only by a tilde was refused for a rule with nothing to say
     * about it. HOME, NOT A SIBLING PATH: somewhere this gate can name from any clone.
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
     * THE PAIR FOR THE TILDE CASE, and the one that matters: accepting shell variables is a
     * loosening, and an unresolved one normalises into a path that is not this repo and unblocks a
     * deploy. Expanding first and testing the RESULT is what prevents that.
     */
    command: "cd $DUSTINEDWARDS_NO_SUCH_VARIABLE/x && npm run deploy",
    cwd: root,
    expect: 2,
    why:
      "an unresolved variable leaves the directory unknown, and unknown must " +
      "read as inside. If this allows, the guard has a bypass that is one " +
      "undefined environment variable wide.",
  },
  /*
   * THE EXECUTABLE-NAME CASES, added for a live bypass of all four arms at once: the bare word
   * matches INSIDE the executable's full name, the dot being a word boundary, so the capture began
   * at the extension. FOLDING THE CHECKER WAS NOT ENOUGH: the hook opens with a CHEAP PREFILTER
   * which ran first, matched neither spelling, and exited before the folded checker was reached.
   */
  {
    label: "a .exe deploy INSIDE the site repo is blocked",
    command: "wrangler.exe deploy",
    cwd: root,
    expect: 2,
    why:
      "the executable suffix is part of the name. If this allows, the segment " +
      "capture is starting at the suffix and every verb comparison is reading " +
      "the wrong token.",
  },
  {
    label: "a .exe deploy in a SIBLING repo is still allowed",
    /*
     * THE CONTROL FOR THE CASE ABOVE: widening the NAME must not widen the SCOPE, the ruling still
     * exempting a sibling repo.
     */
    command: "cd ../dustinedwards-mcp && wrangler.exe deploy",
    cwd: root,
    expect: 0,
    why:
      "ruling 20 is about WHERE the command runs, not how the binary is " +
      "spelled. If this blocks, the name fix has swallowed the scope rule.",
  },
  {
    label: "a .cmd d1 DELETE is blocked, which is the GLOBAL arm",
    command: `wrangler.cmd d1 execute dustinedwards --remote --command "DELETE FROM posts"`,
    cwd: root,
    expect: 2,
    why:
      "the d1 arms are not directory-scoped, so this bypass reached the remote " +
      "database from anywhere. If this allows, hard rule 18 has no enforcement " +
      "left at the hook.",
  },
  {
    label: "an UPPERCASE wrangler deploy is blocked",
    command: "WRANGLER deploy",
    cwd: root,
    expect: 2,
    why:
      "PATH lookup on Windows ignores case, so this is a command that RUNS. If " +
      "this allows, either the checker fold or the prefilter fold is missing.",
  },
  {
    label: "an UPPERCASE npm run deploy is blocked",
    /*
     * THE PREFILTER CASE, which stayed green through the first attempt at the fix: the prefilter is a
     * second statement of the same needle and was still case-sensitive.
     */
    command: "NPM RUN DEPLOY",
    cwd: root,
    expect: 2,
    why:
      "if this allows while the uppercase wrangler case passes, the prefilter " +
      "has gone back to being case-sensitive and the checker below it is dead " +
      "code for exactly the inputs it was widened to catch.",
  },
  {
    label: "a .exe dry run is still allowed",
    /*
     * THE CONTROL FOR THE FOLD: over-blocking is the cheapest way to pass every blocking case while
     * breaking the earlier loosening. The flag is deliberately NOT folded, the argument parser reading
     * flags case-sensitively.
     */
    command: "wrangler.exe deploy --dry-run",
    cwd: root,
    expect: 0,
    why:
      "a dry run uploads nothing and stays allowed under the new name. If this " +
      "blocks, the suffix fix has taken the dry-run exemption with it.",
  },
];

for (const { label, command, cwd, expect, why } of CASES) {
  const code = runHook(command, cwd);
  const verdict = expect === 2 ? "blocked" : "allowed";
  const got = code === 2 ? "blocked" : code === 0 ? "allowed" : `exit ${code}`;
  /*
   * EACH VERDICT IS PRINTED, not only the failures: the value here is that somebody changing the
   * hook can see both directions move.
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
 * EXECUTED-COUNT FLOOR. Every case comes from one array, which fails quietly: one that stopped
 * parsing runs zero cases and reports a clean sweep of a security guard. Slack of zero, the set
 * being a fixed enumeration of the ruling's own cases.
 */
const MINIMUM_CHECKS = 19;
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
