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

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { gateNames } from "./build-stack.mjs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertFloor } from "./lib/floor.mjs";
import { killTree } from "./lib/child-processes.mjs";
import { mb, peakBetween, startRssSampler, treeSince } from "./lib/rss.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * WHERE THE MEMORY SAMPLES GO, and why this run keeps the previous one's file.
 *
 * The OS killed five `check:all` runs for low memory between 2026-09-05 and
 * 2026-09-09 and rebooted the machine once. An OS kill under memory pressure
 * does not take the tree: it takes the process it picked, so the runner dies
 * and its grandchildren keep their pages. The heaviest of them is not small.
 * Measured 2026-09-09 during `check:browser`: a `vite preview` host holding
 * 952 MB with two `workerd` children beside it.
 *
 * So the previous run's file is READ BEFORE this run truncates it. It is the
 * only record of what that run was holding when it died.
 *
 * The read is a UNION over the last stretch of sampling rather than the final
 * row, and that distinction was paid for on 2026-09-09: a run exhausted the
 * machine, 14 processes holding 1678 MB survived it, and the final row named
 * two of them. The heavy ones came from `check:head` minutes earlier and were
 * still resident. Grounds on `treeSince`.
 */
const RSS_FILE = join(root, ".gate-pids", "check-all-rss.csv");

/**
 * The floor. Fails closed when fewer gates are discovered than this.
 *
 * A count, not a list, so it cannot go stale in the direction that matters: a
 * gate deleted, a script renamed out of the `check:` namespace, or a glob that
 * quietly stops matching all show up as a smaller number. It only ever moves UP,
 * and moving it is a deliberate edit in the same commit as the gate.
 */
const MINIMUM_GATES = 33;

/**
 * The one gate this runner does not spawn like the others, because its input is
 * the other gates' output. Named once so the hold-out and the feed cannot come
 * to disagree about which gate that is.
 */
const FLOOR_READER = "check:floors";

/**
 * Gates whose output the floor reader must NOT be fed, with the reason.
 *
 * `check:head` runs the whole offline tier inside an extraction of HEAD, so its
 * stdout carries a full second set of floor lines belonging to OTHER gates and
 * measured against a different tree. Fed in, they arrive after the same gates'
 * own lines and win the dedupe, so a dirty working tree would be judged by the
 * checkout's counts with nothing saying so. `check-floors.mjs` excludes the same
 * gate from its standalone run, for the recursion reason recorded there; this is
 * the same exclusion arriving by a different road.
 *
 * @type {Record<string, string>}
 */
const FLOOR_OUTPUT_EXCLUDED = {
  "check:head": "its stdout carries the whole tier's floor lines, measured against a checkout rather than disk.",
};

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
export const CI_EXCLUDED = {
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
   * Not runnable in CI as it stands, and since 2026-08-25 for ONE reason, not
   * two. The public cases drive a preview build that reads local D1 state, and
   * that state is gitignored, so the aria-current case would find no post to
   * open.
   *
   * The second reason this entry used to carry, "its admin case needs a real
   * session cookie, which CI has no way to hold without a stored credential
   * nobody has ruled on", was FALSIFIED by the smoke credential: the ruling
   * happened (decisions vol 8, 2026-08-24), SMOKE_TOKEN is a stored CI secret,
   * and the admin cases authenticate with it against the DEPLOYED origin, no
   * session cookie involved. Verified on a live run 2026-08-25: 59 checks, the
   * admin block fully executed under the smoke token.
   *
   * So the admin HALF of this gate is CI-capable today and only the public
   * half is not. Splitting the tiers so CI runs the admin sweep, or wiring the
   * whole gate into ship, is Dustin's recorded open call (vol 8); this entry
   * states the measured blocker and decides nothing.
   */
  "check:browser": "its public cases need gitignored local D1 content; the admin cases are CI-capable via SMOKE_TOKEN, pending Dustin's tiering call.",
  /*
   * Reads build/client, which is gitignored build output; the CI job runs
   * `npm ci` and the gates with no client build in front of them. Building in
   * CI to satisfy it would measure a build nothing deploys, since deploys run
   * from this machine's working tree. Same class as check:backup: the input is
   * state a checkout does not have.
   */
  "check:page-payload": "reads gitignored build output under build/client; the CI job does not build the client.",
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
export const TIERS = {
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
  // Reads the build on disk under build/client: the manifest, the chunks, and
  // app/enhance/blog.ts as source. No network, but it measures whatever the
  // last `npm run build` produced, and a stale build is certified as itself;
  // the deployed page's script set is verify-live's assertion.
  "check:page-payload": "offline",
  // Reads each route's action as SOURCE and proves every destructive intent
  // calls the confirmation predicate inside its own branch. It runs no action,
  // so it sees a guard ABSENT, not a guard present and wrong.
  "check:destructive": "offline",
  /*
   * OFFLINE, and it has to be: it replays a PreToolUse hook against constructed
   * payloads and reads exit codes. No network, no build, no deployment, and
   * nothing it does depends on which machine it runs on.
   *
   * IN CI TOO, deliberately not excluded. The hook is the only thing standing
   * between a session and an unreproducible deploy of this Worker, and its
   * scope was narrowed on 2026-09-05; a scope change to a guard fails silently
   * and in the permissive direction, which is exactly the class CI should be
   * watching for rather than one machine.
   */
  "check:hook-scope": "offline",
  /*
   * Runs `bash -n` over every hook and compiles the Python each one embeds. No
   * network, no build. IN CI for the same reason check:hook-scope is: a hook
   * that stops parsing takes the session's guards with it, and twice on
   * 2026-09-05 one did.
   */
  "check:hook-syntax": "offline",
  /*
   * OFFLINE, and it is the slowest gate here by a wide margin because it RUNS
   * the other counting gates to read their floor lines back. That cost is the
   * price of comparing a floor against a count rather than against another
   * number in the same file; the alternatives are argued in the gate's own
   * header. `check-head.mjs` EXCLUDES it, or an extraction would run every
   * counting gate inside a gate that is running every counting gate.
   */
  "check:floors": "offline",
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
  /*
   * The SECOND behavioural gate, and it observes a different subject.
   * `check:tests` imports pure modules into node; this runs the Worker's own
   * modules inside workerd against miniflare-local D1, KV, R2, a Durable
   * Object and the Cache API, so it sees a loader, an action and the entry
   * itself. It cannot see the deployed build or the platform's cache, which
   * are verify-live's and check:browser's.
   *
   * OFFLINE, and asserted rather than asserted-by-hope: `test/worker/setup.ts`
   * installs a `fetch` that THROWS on any outbound call, and
   * `foundation.test.ts` proves it is installed. The layer found its own
   * violation of this on its first run, when /api/health's content-drift check
   * reached api.github.com for real.
   */
  "check:worker": "offline",
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
  /*
   * NETWORK, and it could not be anything else. It fetches the transform route
   * and compares what comes back against the origin object, so it needs both a
   * deployed Worker and the R2 objects behind it. `--local` would read an empty
   * bucket and report a clean sweep, which is the vacuity its own floor exists
   * to refuse.
   */
  "check:image-weight": "network",
  /*
   * NETWORK, and there is no local form of it to fall back to. It reads the
   * monitors off UptimeRobot's API with an operator credential from `.dev.vars`,
   * and a clean checkout has neither the credential nor anything local to read:
   * an "offline" mode could only report that it did not look, which is the
   * vacuity its own fail-closed branches exist to refuse.
   */
  "check:uptime": "network",
  "check:mail": "network",
  /*
   * NETWORK, and there is no offline form of it that means anything.
   *
   * It creates a real D1 database, applies the migrations to it, loads an
   * export taken from the deployed database, and deletes it again. A `--local`
   * form would restore miniflare state into miniflare state and compare an
   * empty database with an empty database, which is the vacuity every floor in
   * this repo exists to refuse.
   *
   * It is also the most EXPENSIVE gate here by wall clock, because every step
   * is a round trip to the platform rather than a local read. That is why the
   * weekly workflow runs it and `check:all` reaches it only when somebody asks
   * for the whole tier.
   */
  "check:restore": "network",
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
  /*
   * Its config-against-example comparison is pure and stays in the offline tier
   * ship runs. `--remote` adds the third source, the cron triggers actually
   * REGISTERED on the two Workers, which is where a trigger that exists on the
   * platform and in no config shows up and nowhere else. One did, hourly, for
   * fifteen days.
   */
  "check:config": ["--remote"],
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

  const gatesFloorBreach = assertFloor(
    "check:all",
    "gates-discovered",
    names.length,
    MINIMUM_GATES,
    "A gate has been deleted or renamed out of the check: namespace. If that was " +
      "deliberate, lower MINIMUM_GATES in the same commit.",
  );
  if (gatesFloorBreach) {
    throw new Error(`${gatesFloorBreach}\n  found: ${names.join(", ")}`);
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
  /*
   * A GATE THAT COULD NOT RUN IS NOT A GATE THAT FAILED, and the table must not
   * say it was.
   *
   * ## MEASURED, and it cost three diagnoses
   *
   * A `ship` run recorded `check:types FAILED (2.5s)`, `check:urls FAILED
   * (0.0s)` and `check:worker FAILED (0.0s)`, each with an EMPTY output
   * section, immediately after a 258.6s `check:head`. Nothing ran, so nothing
   * was asserted about the subject either way. The same shape is recorded in
   * `check-head.mjs` from 2026-08-20, where fourteen consecutive gates
   * "failed" in 0.0 to 0.2s and every one was green when re-run alone.
   *
   * Reported as FAILED, that is a lie in the direction that wastes the most
   * time: somebody goes looking for a defect in a gate's subject when the
   * finding is that the machine ran out of room. It is also the direction that
   * can hide a real regression, because three noisy reds train the reader to
   * re-run rather than read.
   *
   * ## THE TEST IS THE SHAPE, NOT AN EXIT CODE, AND THAT IS THE SECOND ATTEMPT
   *
   * The first version tested for a `spawnSync` error, a null status, a signal,
   * or exit 143. It was proven by planting a gate that exits 143, it passed
   * that plant, AND IT DID NOTHING WHEN THE REAL CASCADE HAPPENED: a killed
   * ship on 2026-08-31 reproduced all sixteen empty gates and the summary still
   * read `9 passed, 16 failed`. The plant had confirmed the model rather than
   * the world, which is hard rule 12's own warning about a dichotomy
   * inheriting its author's frame.
   *
   * The measured signature of the real event is: `error` undefined, `signal`
   * null, `status` a number that is neither 0 nor 143, and BOTH STREAMS EMPTY.
   * Only the last of those distinguishes it from an ordinary failure, so it is
   * the whole test. An exit code list can always be one code short; "it printed
   * nothing at all" cannot.
   *
   * ## WHAT LICENSES THE SHAPE IS A MEASUREMENT, NOT AN ARGUMENT
   *
   * Every offline gate was run and both streams were counted in bytes, on
   * 2026-08-31: 25 of 25 wrote to stdout, none produced zero bytes on both
   * streams, and the quietest wrote 81. So an empty pair cannot be a gate that
   * ran, because no gate in this repo is capable of running silently.
   *
   * BOTH streams, never either: 23 of those 25 wrote nothing to stderr on a
   * clean pass, so testing either one alone would call almost every green gate
   * an error. If a future gate is ever written to succeed silently, this
   * misreports it, and the repair is to make that gate say something, which
   * every other gate here already does.
   *
   * NOT FOLDED INTO `ok`. An errored gate is not a pass, so `ok` stays false and
   * every caller that gates on it, including the two builds above, still
   * refuses.
   */
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const errored = stdout.length === 0 && stderr.length === 0;

  /*
   * The reason REPORTS the disposition; it never decides it. Whatever the exit
   * code turns out to be on the next host, the classification above already
   * happened and this only says what was seen alongside it.
   */
  const seen = [
    `status ${result.status === null ? "null" : result.status}`,
    result.signal ? `signal ${result.signal}` : null,
    result.error ? `spawn error: ${result.error.message}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    name,
    ok: !errored && result.status === 0,
    errored,
    reason: errored ? `wrote nothing to either stream (${seen})` : "",
    ms: Date.now() - started,
    output: `${stdout}${stderr}`,
    /*
     * Filled in by the caller, which owns the clock: this function cannot see
     * the sample file's window because it IS the window. Null means the
     * sampler did not run or the gate finished inside one sampling interval,
     * and null is deliberately not zero.
     *
     * @type {number | null}
     */
    peakRss: /** @type {number | null} */ (null),
  };
}

function main() {
  const gates = discoverGates();

  /*
   * THE STACK ARTIFACT, BUILT FIRST, and the order is load-bearing rather than
   * tidy: `build:content` reads content/generated/stack.json to emit the
   * colophon's page records, so a run that built the corpus first would render
   * pages from whatever stack.json a previous run left behind.
   *
   * Gitignored since ruling 39a. It was committed and byte-gated until then,
   * which made every package.json change a two-file change and put every
   * Renovate PR red on check:stack with no defect in it. Same class of step as
   * the two below: not a gate, no table row, no floor.
   */
  process.stdout.write("  build:stack (the colophon artifact build:content reads) ... ");
  const stacked = runGate("build:stack", []);
  if (!stacked.ok) {
    console.log("FAILED");
    console.log(stacked.output.trimEnd());
    throw new Error(
      "build:stack failed, so content/generated/stack.json does not exist on disk. " +
        "Nothing below ran; fix the stack build first.",
    );
  }
  console.log(`ok (${(stacked.ms / 1000).toFixed(1)}s)`);
  /*
   * THE LOCAL BUILD PRODUCT IS BUILT BEFORE ANY GATE READS IT. Since the
   * artifact arc, content/generated/posts.json is gitignored: git holds
   * markdown, D1 holds the rendered copy, and this file exists on disk only
   * because something built it. Several offline gates read it
   * (check:content's determinism pass builds its own, check:diagrams,
   * check:features and the sync path read the file), so a runner that did
   * not build first would read whatever a previous run left behind, or
   * nothing. Refused loudly rather than left to each gate's own missing-file
   * message, because "the build is broken" and "a gate is red" are different
   * findings and the table below should carry the second kind only.
   *
   * Not a gate: it appears in no table and counts toward no floor. It is the
   * same class of step as `actions/checkout`.
   */
  process.stdout.write("  build:content (the local build product the tier reads) ... ");
  const built = runGate("build:content", []);
  if (!built.ok) {
    console.log("FAILED");
    console.log(built.output.trimEnd());
    throw new Error(
      "build:content failed, so the tier's subject does not exist on disk. " +
        "Nothing below ran; fix the build first.",
    );
  }
  console.log(`ok (${(built.ms / 1000).toFixed(1)}s)`);
  /*
   * THE ENHANCEMENT BUNDLES, same class as build:content: app/enhance/dist/ is
   * gitignored build product, the app build's ?url imports refuse to resolve
   * without it, and a stale bundle on disk would be certified as itself by any
   * gate that reads the build. Built here so the tier never depends on a
   * previous run having left the right bytes behind. Not a gate: no table row,
   * no floor.
   */
  process.stdout.write("  build:enhance (the bundles the app build's ?url imports serve) ... ");
  const enhanced = runGate("build:enhance", []);
  if (!enhanced.ok) {
    console.log("FAILED");
    console.log(enhanced.output.trimEnd());
    throw new Error(
      "build:enhance failed, so the enhancement bundles do not exist on disk. " +
        "Nothing below ran; fix the bundle build first.",
    );
  }
  console.log(`ok (${(enhanced.ms / 1000).toFixed(1)}s)`);
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

  /*
   * PREFLIGHT: WHAT THE LAST RUN LEFT ALIVE.
   *
   * Reads the previous run's final sample and tree-kills anything in it that
   * is still running. This is the half that addresses the actual incident:
   * gates inside one run cannot overlap (the loop below is a blocking
   * `spawnSync`, measured, not assumed), so the memory that accumulates comes
   * from RUNS, not from gates racing each other. A killed run's orphans are
   * still holding their pages when the next run starts, and the next run then
   * starts that much closer to the ceiling.
   *
   * BY PID, NEVER BY NAME. `killTree` is `taskkill /F /T /PID`. A name match
   * for `node` or `chrome` on this machine reaches Dustin's own editor and
   * browser: measured 2026-09-09, a bare name match selects 18 Chrome
   * processes belonging to his session. An absent pid is simply done, and pids
   * are reused, so anything that will not die is reported rather than chased.
   */
  const leftovers = treeSince(RSS_FILE).filter((pid) => pid !== process.pid);
  if (leftovers.length > 0) {
    let reaped = 0;
    for (const pid of leftovers) if (killTree(pid)) reaped += 1;
    console.log(
      `  preflight: the previous run left ${leftovers.length} process(es) recorded, ${reaped} reaped\n`,
    );
  }

  /*
   * THE SAMPLER, and the cleanup that owns it.
   *
   * `spawnSync` blocks this process for the whole of every gate, so nothing in
   * this event loop can measure anything while a gate runs. The sampler is a
   * separate process writing to a file; grounds on `scripts/lib/rss.mjs`.
   */
  mkdirSync(join(root, ".gate-pids"), { recursive: true });
  writeFileSync(RSS_FILE, "");
  const sampler = startRssSampler(RSS_FILE);

  /**
   * KILLS THIS RUN'S OWN TREE. Registered for a normal exit and for both
   * signals, so a Ctrl+C stops leaving the heavy children behind.
   *
   * It cannot cover every case and says so rather than pretending: a
   * `taskkill /F` of this process, and an OS kill under memory pressure, run
   * no handler at all. That is precisely why the preflight above exists, and
   * between the two the orphan either dies now or dies at the start of the
   * next run.
   */
  let cleanedUp = false;
  const cleanUp = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    const alive = treeSince(RSS_FILE).filter((pid) => pid !== process.pid && pid !== sampler.pid);
    for (const pid of alive) killTree(pid);
    sampler.stop();
  };
  process.on("exit", cleanUp);
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) {
    process.on(signal, () => {
      cleanUp();
      // Re-raise as an exit rather than returning: a handled signal that does
      // not exit leaves the runner alive with its work abandoned.
      process.exit(130);
    });
  }

  /** @type {ReturnType<typeof runGate>[]} */
  const results = [];
  /*
   * check:floors RUNS LAST AND READS, RATHER THAN RUNNING EVERYTHING AGAIN.
   *
   * It compares each floor against the count the owning gate printed, and every
   * one of those lines is already in the output captured just below. Spawning it
   * as an ordinary gate made it re-run the whole offline tier to reproduce text
   * this loop had already collected: 223.3s of a 1065s tier, measured 2026-09-06,
   * paid on every ship.
   *
   * So it is held out of the loop and fed afterwards. Held out rather than
   * reordered in the list, because the list is DERIVED and sorting it by hand
   * would be a second opinion about what runs.
   */
  const readsFloorLines = selected.includes(FLOOR_READER);
  const spawnable = selected.filter((name) => name !== FLOOR_READER);

  for (const name of spawnable) {
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
    const from = Date.now();
    const result = runGate(name, args);
    /*
     * The window closes AFTER the gate returns, so a sample taken while its
     * children were still dying belongs to the gate that spawned them rather
     * than to whichever gate runs next. The gates cannot overlap, so the
     * windows cannot either.
     */
    result.peakRss = peakBetween(RSS_FILE, from, Date.now());
    results.push(result);
    const seconds = (result.ms / 1000).toFixed(1);
    const peak = result.peakRss === null ? "" : ` ${mb(result.peakRss)}`;
    console.log(
      result.errored
        ? `ERRORED (${seconds}s${peak}) ${result.reason}`
        : result.ok
          ? `ok (${seconds}s${peak})`
          : `FAILED (${seconds}s${peak})`,
    );
  }

  /*
   * THE FLOOR READER, fed the run that just happened.
   *
   * `gates` is passed separately and is not derivable from the text: the
   * silent-gate assertion asks which gates printed NO floor line, and a gate
   * that printed nothing leaves no trace in a concatenation of what was
   * printed.
   *
   * Only gates that PASSED contribute. A floor line from a gate that then
   * refused is a number the producing gate disowned, and check:all is already
   * reporting that gate as red; letting its floors through would have the same
   * failure argued twice, in two voices, one of them wrong about the cause.
   */
  if (readsFloorLines) {
    process.stdout.write(`  ${FLOOR_READER} ... `);
    const usable = results.filter((r) => r.ok && !FLOOR_OUTPUT_EXCLUDED[r.name]);
    const payload = JSON.stringify({
      gates: usable.map((r) => r.name),
      output: usable.map((r) => r.output).join("\n"),
    });
    const started = Date.now();
    const spawned = spawnSync(
      process.execPath,
      [join(root, "scripts", "check-floors.mjs"), "--from-stdin"],
      { cwd: root, encoding: "utf8", input: payload, maxBuffer: 64 * 1024 * 1024 },
    );
    const stdout = spawned.stdout ?? "";
    const stderr = spawned.stderr ?? "";
    const floorsResult = {
      name: FLOOR_READER,
      ok: spawned.status === 0 && (stdout.length > 0 || stderr.length > 0),
      errored: stdout.length === 0 && stderr.length === 0,
      reason:
        stdout.length === 0 && stderr.length === 0
          ? `wrote nothing to either stream (status ${spawned.status})`
          : "",
      ms: Date.now() - started,
      output: `${stdout}${stderr}`,
      // Measured on the same terms as every other gate: it is spawned like one,
      // and a gate excluded from the table is a gate nobody would think to look at.
      peakRss: peakBetween(RSS_FILE, started, Date.now()),
    };
    results.push(floorsResult);
    const seconds = (floorsResult.ms / 1000).toFixed(1);
    console.log(
      floorsResult.errored
        ? `ERRORED (${seconds}s) ${floorsResult.reason}`
        : floorsResult.ok
          ? `ok (${seconds}s)`
          : `FAILED (${seconds}s)`,
    );
  }

  // Three outcomes, counted apart. See runGate: an errored gate produced no
  // verdict, so calling it a failure invents one and calling it a pass hides one.
  const errored = results.filter((r) => r.errored);
  const failed = results.filter((r) => !r.ok && !r.errored);

  // The failing output, in full, AFTER the run rather than interleaved. A
  // failure buried in the middle of thirteen gates' output is a failure nobody
  // reads.
  for (const result of failed) {
    console.log(`\n${"=".repeat(72)}\n${result.name}\n${"=".repeat(72)}`);
    console.log(result.output.trimEnd());
  }

  // Errored gates get their own block, and the empty output IS the evidence: a
  // gate that never started has nothing to say, and printing that emptiness
  // under its own heading is what distinguishes it from a silent failure.
  for (const result of errored) {
    console.log(`\n${"=".repeat(72)}\n${result.name}  (ERRORED, no verdict)\n${"=".repeat(72)}`);
    console.log(`  ${result.reason}`);
    /*
     * There is deliberately nothing to print after that line. An errored gate
     * is DEFINED by both its streams being empty, so a branch here for the case
     * where it said something would be a condition that cannot be true, which
     * is hard rule 10's first class. The emptiness IS the evidence.
     */
  }

  console.log(`\n${"-".repeat(52)}`);
  for (const result of results) {
    const label = result.errored ? "ERR " : result.ok ? "PASS" : "FAIL";
    console.log(
      `  ${label}  ${result.name.padEnd(18)} ${(result.ms / 1000).toFixed(1).padStart(6)}s` +
        `${result.peakRss === null || result.peakRss === undefined ? "" : ` ${mb(result.peakRss).padStart(7)}`}`,
    );
  }
  for (const name of skipped) {
    // Named, not omitted. A gate that silently did not run is the thing this
    // file exists to prevent, and that includes the ones it skipped on purpose.
    console.log(`  SKIP  ${name.padEnd(18)} needs the network, run: npm run check:all`);
  }
  console.log(`${"-".repeat(52)}`);

  /*
   * PEAK MEMORY IN THE SUMMARY LINE, because the number that matters for an
   * out-of-memory kill is the highest point the tier reached, and which gate
   * was holding it. A per-gate table nobody totals is a table nobody reads.
   */
  /** @type {{ name: string, peakRss: number } | null} */
  let worst = null;
  for (const result of results) {
    if (typeof result.peakRss !== "number") continue;
    if (worst === null || result.peakRss > worst.peakRss) {
      worst = { name: result.name, peakRss: result.peakRss };
    }
  }

  console.log(
    `\n${results.length - failed.length - errored.length} passed, ${failed.length} failed` +
      `${errored.length > 0 ? `, ${errored.length} errored` : ""}` +
      `${skipped.length > 0 ? `, ${skipped.length} skipped` : ""}` +
      `${worst ? `, peak ${mb(worst.peakRss)} at ${worst.name}` : ", peak not measured"}\n`,
  );

  if (!sampler.available) {
    console.log(
      "  Peak memory was NOT measured on this run: the sampler could not start.\n" +
        "  The tier is unaffected; this is an instrument, not a gate.\n",
    );
  }
  if (errored.length > 0) {
    console.log(
      `  ${errored.length} gate(s) ERRORED: ${errored.map((r) => r.name).join(", ")}.\n` +
        "  An errored gate asserted NOTHING about its subject, in either direction. It is\n" +
        "  not a red gate and it is not a green one, so this run does not cover what it\n" +
        "  would have covered. Re-run those gates alone before reading anything into them:\n" +
        "  the usual cause is a saturated machine, not a defect.\n",
    );
  }

  if (!all) {
    console.log(
      "  NOT COVERED by this tier: check:media against the deployed index, and\n" +
        "  check:backup / check:llms against the remote database. `npm run check:all`\n" +
        "  adds them. Neither tier covers verify-live, which needs a deploy.\n",
    );
  }

  // An errored run exits nonzero too. It did not prove the tier green, and the
  // one thing that must never happen is a ship reading "0 failed" off a tier
  // where three gates never started.
  process.exit(failed.length > 0 || errored.length > 0 ? 1 : 0);
}

/*
 * MAIN GUARD, so `TIERS` above can be imported without running the suite.
 *
 * `check:floors` needs the tier map: it runs gates to read their floor lines
 * back, and it must run the OFFLINE ones only, or an offline tier would reach
 * the network through it. Without this guard, importing that map would start a
 * full check run inside the gate that was asking which gates to run.
 *
 * `pathToFileURL` rather than string surgery on process.argv[1], and the reason
 * is measured in `build-stack.mjs`: on Windows the hand-built `file://C:\...`
 * form never equals import.meta.url, so the guard silently never fires.
 */
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main();
  } catch (error) {
    console.error(`\ncheck failed to start. ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
