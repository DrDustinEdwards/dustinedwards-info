/**
 * Runs every gate and reports one table.
 *
 *   npm run check         the offline tier: everything that needs no network
 *   npm run check:all     adds the gates that need a deployed database or bucket
 *
 * OBSERVATION BOUNDARY: this runs gates and reports their exit codes. It does
 * not know what any of them checks, cannot tell a gate that passed from one that
 * passed vacuously, and a gate that exits 0 while examining nothing is invisible
 * here. That property belongs to each gate, and it is why every one of them
 * carries its own boundary note.
 *
 * ## Why this exists
 *
 * Two defects shipped in three sessions because a gate was silently not run.
 * `check:admin-ui` was red for two full sessions after a loader-shape change,
 * and nobody noticed because running gates meant remembering which ones the
 * change touched. Remembering is not a mechanism. One command that runs all of
 * them is.
 *
 * ## It runs everything, then reports
 *
 * A runner that stops at the first failure hides every gate behind it, which is
 * exactly how one red gate masks a second. Every gate runs, always, and the
 * table at the end is the whole picture.
 *
 * ## The list is DERIVED
 *
 * Parsed out of package.json's `check:*` scripts, on the same rule
 * `check-backup.mjs` follows for its table list: a hardcoded list is how the
 * next gate gets forgotten. That is not hypothetical here. The instruction that
 * asked for this runner named eleven gates and listed twelve, and the repo has
 * THIRTEEN: `check:llms` appeared in neither count.
 */

import { readFileSync } from "node:fs";

import { gateNames } from "./build-stack.mjs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The floor. Fails closed when fewer gates are discovered than this.
 *
 * A count, not a list, so it cannot go stale in the direction that matters: a
 * gate deleted, a script renamed out of the `check:` namespace, or a glob that
 * quietly stops matching all show up as a smaller number. It only ever moves UP,
 * and moving it is a deliberate edit in the same commit as the gate.
 */
const MINIMUM_GATES = 25;

/**
 * Gates a CLEAN CHECKOUT cannot run, each with the reason it cannot.
 *
 * MEASURED 2026-08-20, not guessed: HEAD was extracted with `git archive`,
 * `npm ci` was run in it, and the offline tier was run there. 22 passed, 4
 * failed. Two of those four are real and permanent, and they are here. The other
 * two, `check:content` and `check:head`, failed only because `git archive`
 * produces no `.git` directory; `actions/checkout` provides a real repository,
 * so both work in CI and neither is excluded for that reason.
 *
 * Same shape and the same discipline as `check-head.mjs`'s own EXCLUDED map:
 * a named reason per entry, so an exclusion has to be argued rather than
 * accumulated.
 *
 * @type {Record<string, string>}
 */
const CI_EXCLUDED = {
  /*
   * MEASURED in the clean checkout. It asserts the tracked example DIFFERS from
   * the real `wrangler.jsonc` in the two account-scoped ids. A checkout has no
   * real config, `postinstall` bootstraps one BY COPYING the example, so real
   * equals example by construction and the gate cannot pass. Verbatim:
   *
   *   FAIL  example's database_id is not the real one
   *   FAIL  example's KV id is not the real one
   *
   * That is the gate being CORRECT, not a limitation to work around, and it is
   * why this gate is load-bearing on exactly one machine. `check-head.mjs`
   * excludes it for the identical reason.
   */
  "check:config": "cannot pass in any checkout: bootstrap copies the example, so real == example.",
  /*
   * MEASURED in the clean checkout. Defaults to `--local`, which reads
   * miniflare state under `.wrangler/`. That directory is gitignored and absent
   * from a checkout. Verbatim:
   *
   *   SENTRY_DO SQLite failed; dbErrorMess...
   *
   * Provisioning a local D1 in CI to satisfy it would be inventing state to
   * check a backup path against, which asserts nothing about the real database.
   */
  "check:backup": "needs the gitignored .wrangler/ miniflare state, absent from a checkout.",
  /*
   * NOT a capability problem. It would very likely RUN in CI, since
   * `actions/checkout` gives a real repository and node ignores the "junction"
   * link type off Windows.
   *
   * It is excluded because it is VACUOUS there. This gate exists to catch disk
   * disagreeing with HEAD, and CI has only HEAD: it checks out the ref into an
   * empty machine, so there is no working tree to diverge. Running it would
   * extract HEAD from a checkout of HEAD and compare it to itself, then report
   * a green it could not have failed. That is the vacuity class this repo names
   * everywhere else, and running it in CI would be adding an instance.
   */
  "check:head": "vacuous in CI: it compares disk to HEAD, and CI has only HEAD.",
  /*
   * Not runnable in CI as it stands, for two separate reasons and only the
   * second is fixable. It reads local D1 state to render a post list, and that
   * state is gitignored, so the aria-current case would find no post to open.
   * And its admin case needs a real session cookie, which CI has no way to hold
   * without a stored credential nobody has ruled on.
   */
  "check:browser": "needs local D1 state for content, and a real session for the admin case.",
};

/**
 * Which gates need something this machine may not have.
 *
 * Every discovered gate MUST appear here or the runner refuses to start. That is
 * the same fail-closed shape as the count above, applied to classification: a
 * new gate that nobody tiered would otherwise be silently dropped from the
 * offline run and never noticed, which is the failure this whole file exists
 * about.
 *
 *   offline  no network, no deployed resources. Safe on a plane.
 *   network  reads a deployed D1 database or R2 bucket.
 *
 * @type {Record<string, "offline" | "network" | undefined>}
 */
const TIERS = {
  /*
   * THE TYPECHECK IS A GATE, ruled 2026-08-20 after the suite certified a build
   * it had never compiled.
   *
   * `tsc -b` was a separate npm script and a Stop hook, and neither is the
   * suite. So `npm run check` reported 25 passed 0 failed over source with two
   * TS7006 errors in it, and `check:head` inherited exactly the same blind spot
   * and certified 32 checks 0 failures against the same red build. A suite that
   * certifies a build it never compiled is this repo's own vacuity class raised
   * to the top level: the runner cannot tell a gate that passed from one that
   * passed over code that cannot run.
   *
   * It made it past four separate checks, which is the part worth recording:
   * tsc was not re-run after the change, `npm run check` does not typecheck,
   * `check:head` runs that same offline tier, and the Stop hook reported "No
   * stderr output" because tsc writes diagnostics to STDOUT.
   *
   * OFFLINE, and that is the load-bearing half rather than a formality:
   * `check:head` derives its list from the offline tier, so tiering this here
   * is what makes an extracted HEAD get typechecked too. The worktree already
   * has node_modules by junction and a bootstrapped wrangler.jsonc, which is
   * what `npm run typecheck` needs.
   *
   * IT DELEGATES rather than restating `wrangler types && react-router typegen
   * && tsc -b`, on the same anti-mirror rule the Stop hook follows:
   * package.json is the one place that defines what a typecheck is, and a
   * mirror drifts. This repo has already run a bare `npx tsc -b` against stale
   * generated types for exactly that reason.
   *
   * ALPHABETICAL, NOT FIRST, and the alternative was considered. Running it
   * first would surface the most fundamental failure earliest in a five minute
   * run. It was rejected because this runner's stated principle is that EVERY
   * gate runs and the table at the end is the whole picture, so position
   * changes only when a watcher sees the line, never whether the failure is
   * reported. Hoisting one name would also cost the derivation property that
   * keeps a new gate from being forgotten, which is a worse trade than a later
   * line in a table that is read whole.
   */
  "check:types": "offline",
  "check:content": "offline",
  "check:config": "offline",
  "check:search": "offline",
  "check:policy": "offline",
  "check:contrast": "offline",
  "check:logo": "offline",
  "check:charts": "offline",
  "check:diagrams": "offline",
  "check:admin-ui": "offline",
  "check:urls": "offline",
  // Reads the two media modules as source and proves every listing axis
  // `listMediaPage` declares is both READ there and FORWARDED by `listMedia`.
  // It runs no query, so it sees an axis DROPPED and not one built into wrong
  // SQL; the query itself is check:media's and verify-live's subject.
  "check:media-axes": "offline",
  // Reads each route's action as SOURCE and proves every destructive intent
  // calls the confirmation predicate inside its own branch. It runs no action,
  // so it sees a guard ABSENT, not a guard present and wrong.
  "check:destructive": "offline",
  // Reads the tracked example config, package.json and drizzle/. No network.
  "check:stack": "offline",
  // Parses routes.ts and reads gate scripts off disk. No network.
  "check:features": "offline",
  // Reads workers/app.ts and nothing else. It asserts what the SOURCE declares
  // and cannot see the wire; the deployed headers are verify-live's assertions.
  "check:headers": "offline",
  // Reads source text under app/ and workers/ and asserts the secret-handling
  // boundary. It cannot see the emitted bundle, so a secret inlined into a
  // client chunk by a mis-split is invisible here; the header says so.
  "check:secrets": "offline",
  // sha256s drizzle/*.sql against drizzle/manifest.json, both directions. Reads
  // files and nothing else. It proves the files match the manifest, NOT that
  // the manifest was honest when written and NOT what the live database
  // applied; that half is check:invariants --remote.
  "check:migrations": "offline",
  // Extracts a ref into a throwaway worktree and runs the offline tier THERE.
  // Offline: git plus a node_modules junction, no network. It is the only gate
  // that observes a CHECKOUT rather than the disk, so it sees uncommitted work
  // and line-ending divergence; it cannot see the deployed build, and it
  // inherits the blindness of the two gates it must exclude.
  "check:head": "offline",
  // node:test over test/. The ONE gate here that asserts BEHAVIOUR rather than
  // the repo's shape: it imports shipped modules and checks what they do with a
  // given input. See test/README.md for the three-instrument split.
  "check:tests": "offline",
  // Offline by DEFAULT: esbuild plus in-memory SQLite, no network, no bindings.
  // `--remote` adds the live database as a third schema source, and check:all
  // passes it. Same shape as check:llms and check:backup.
  "check:invariants": "offline",
  // Pure by default; the D1 comparison is opt-in behind --local/--remote.
  "check:llms": "offline",
  // Defaults to --local, which reads miniflare state on disk rather than the
  // deployed database. `check:all` re-runs it against --remote.
  "check:backup": "offline",
  // NO OFFLINE MODE THAT MEANS ANYTHING. It reconciles D1 against two R2
  // buckets, and --local reads an empty miniflare bucket, so a local run would
  // report drift that does not exist. Network tier, always.
  /*
   * NETWORK, and the tiering was the hardest call in this gate.
   *
   * It wants to be offline: it drives localhost and asserts nothing about a
   * deployed resource. Two measured facts stop it. Starting the preview server
   * prints "Establishing remote connection" because the AI_SEARCH binding
   * always reaches a real instance even in local dev, so the offline tier's
   * contract, safe on a plane, would be false. And it costs 67s measured,
   * against a 26-gate tier, which is a large tax on every run of the tier ship
   * executes.
   *
   * The consequence is stated rather than hidden: `npm run check` does NOT run
   * this, so neither does `ship`. Layout defects can still ship. Wiring it into
   * ship is a one-line change and is RECOMMENDED, not taken here, because
   * changing what ship refuses is a decision about the release path rather than
   * part of building an instrument.
   */
  "check:browser": "network",
  "check:media": "network",
};

/**
 * Extra arguments for the `check:all` run, where the network is available.
 * @type {Record<string, string[] | undefined>}
 */
const REMOTE_ARGS = {
  "check:backup": ["--remote"],
  "check:llms": ["--remote"],
  "check:media": ["--remote"],
  // Its schema.ts-against-migrations comparison is pure; --remote adds the
  // third source, the live database, which is where an unapplied migration or a
  // hand-altered column would show up and nowhere else.
  "check:invariants": ["--remote"],
};

const all = process.argv.includes("--all");
/** `--ci` runs the offline tier minus what a clean checkout cannot run. */
const ci = process.argv.includes("--ci");

/** Every `check:*` script package.json declares, minus the runners themselves. */
function discoverGates() {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  /*
   * ONE DERIVATION, imported rather than restated. This file and
   * `build-stack.mjs` both used to filter `check:*` themselves, agreeing until
   * one of them gained a case: `check:ci` is the second aggregate runner, and
   * the colophon's copy would have listed it as a gate and claimed 28 where 27
   * exist. Excluding a runner here is not tidiness either, it is what stops the
   * runner invoking itself forever.
   */
  const names = gateNames(pkg);

  if (names.length < MINIMUM_GATES) {
    throw new Error(
      `discovered ${names.length} gate(s) but expected at least ${MINIMUM_GATES}. ` +
        `A gate has been deleted or renamed out of the check: namespace. If that was ` +
        `deliberate, lower MINIMUM_GATES in the same commit.\n  found: ${names.join(", ")}`,
    );
  }

  const untiered = names.filter((name) => !TIERS[name]);
  if (untiered.length > 0) {
    throw new Error(
      `${untiered.length} gate(s) are not classified in TIERS: ${untiered.join(", ")}. ` +
        `Add each as "offline" or "network". Refusing to run rather than silently ` +
        `dropping them from the default tier.`,
    );
  }

  return names;
}

/** @param {string} name @param {string[]} args */
function runGate(name, args) {
  const started = Date.now();
  const result = spawnSync(`npm run ${name}${args.length ? ` -- ${args.join(" ")}` : ""}`, {
    cwd: root,
    encoding: "utf8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    name,
    ok: result.status === 0,
    ms: Date.now() - started,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

function main() {
  const gates = discoverGates();
  /*
   * THE CI TIER IS THE OFFLINE TIER MINUS CI_EXCLUDED, derived rather than
   * listed, so a gate added tomorrow is in CI by default and has to be argued
   * OUT rather than remembered IN. That direction is the whole point: the
   * failure this file exists about is a gate silently not running.
   *
   * `--all` and `--ci` are not combinable, and nothing tries: `--all` adds the
   * network tier, which is exactly what CI has no credentials for.
   */
  const offline = gates.filter((name) => TIERS[name] === "offline");
  const selected = all ? gates : ci ? offline.filter((name) => !CI_EXCLUDED[name]) : offline;
  const skipped = gates.filter((name) => !selected.includes(name));

  if (ci) {
    /*
     * SCOPE, ASSERTED. An exclusion map that named a gate nobody declares would
     * silently exclude nothing, and this would report a full CI run while
     * quietly being the plain offline tier. Same fail-closed shape as the
     * untiered check above.
     */
    const unknown = Object.keys(CI_EXCLUDED).filter((name) => !gates.includes(name));
    if (unknown.length > 0) {
      throw new Error(
        `CI_EXCLUDED names ${unknown.length} gate(s) package.json does not declare: ` +
          `${unknown.join(", ")}. Refusing to run rather than excluding nothing.`,
      );
    }
    console.log(
      `  CI tier: ${selected.length} of ${offline.length} offline gate(s). ` +
        `Excluded, with reasons in CI_EXCLUDED: ${Object.keys(CI_EXCLUDED).join(", ")}`,
    );
  }

  console.log(
    `\n${all ? "check:all" : "check"} running ${selected.length} of ${gates.length} gate(s)` +
      `${all ? " (offline + network)" : " (offline tier)"}\n`,
  );

  /** @type {ReturnType<typeof runGate>[]} */
  const results = [];
  for (const name of selected) {
    // JUSTIFIED SUBSTITUTION (hard rule 13). `REMOTE_ARGS` is DELIBERATELY
    // PARTIAL: most gates take no remote arguments, and their absence from the
    // map means exactly that. The empty array is the correct value for a gate
    // with no extra args, not a stand-in for a missing one, so nothing is being
    // masked. Contrast WHY_LABEL and STATUS_LABEL, where every key was supposed
    // to be present and the fallback hid the omission.
    const args = all ? (REMOTE_ARGS[name] ?? []) : [];
    process.stdout.write(`  ${name}${args.length ? ` ${args.join(" ")}` : ""} ... `);
    // EVERY gate runs, including after a failure. Stopping at the first red hides
    // every gate behind it, which is how one failure masks a second.
    const result = runGate(name, args);
    results.push(result);
    console.log(result.ok ? `ok (${(result.ms / 1000).toFixed(1)}s)` : `FAILED (${(result.ms / 1000).toFixed(1)}s)`);
  }

  const failed = results.filter((r) => !r.ok);

  // The failing output, in full, AFTER the run rather than interleaved. A
  // failure buried in the middle of thirteen gates' output is a failure nobody
  // reads.
  for (const result of failed) {
    console.log(`\n${"=".repeat(72)}\n${result.name}\n${"=".repeat(72)}`);
    console.log(result.output.trimEnd());
  }

  console.log(`\n${"-".repeat(52)}`);
  for (const result of results) {
    console.log(
      `  ${result.ok ? "PASS" : "FAIL"}  ${result.name.padEnd(18)} ${(result.ms / 1000).toFixed(1)}s`,
    );
  }
  for (const name of skipped) {
    // Named, not omitted. A gate that silently did not run is the thing this
    // file exists to prevent, and that includes the ones it skipped on purpose.
    console.log(`  SKIP  ${name.padEnd(18)} needs the network, run: npm run check:all`);
  }
  console.log(`${"-".repeat(52)}`);

  console.log(
    `\n${results.length - failed.length} passed, ${failed.length} failed` +
      `${skipped.length > 0 ? `, ${skipped.length} skipped` : ""}\n`,
  );

  if (!all) {
    console.log(
      "  NOT COVERED by this tier: check:media against the deployed index, and\n" +
        "  check:backup / check:llms against the remote database. `npm run check:all`\n" +
        "  adds them. Neither tier covers verify-live, which needs a deploy.\n",
    );
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

try {
  main();
} catch (error) {
  console.error(`\ncheck failed to start. ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
