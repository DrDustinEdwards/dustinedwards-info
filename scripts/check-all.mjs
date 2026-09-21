/**
 * Runs every gate and reports one table: `npm run check` (offline) or `npm run check:all`.
 * It sees exit codes only, runs every gate even after a failure, and derives the list from
 * package.json so a new gate cannot be forgotten.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { gateNames } from "./build-stack.mjs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertFloor } from "./lib/floor.mjs";
import { killTree, readProcessTable } from "./lib/child-processes.mjs";
import { mb, peakBetween, startRssSampler, treeSince } from "./lib/rss.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The previous run's samples are read before truncation: after an OS kill they are the only
 * record of what it held.
 */
const RSS_FILE = join(root, ".gate-pids", "check-all-rss.csv");

/** Fails closed below this. Moves up only to the count a run printed, never to a sum. */
const MINIMUM_GATES = 40;

/** check:floors reads the other gates' output, so it is not spawned like them. */
const FLOOR_READER = "check:floors";

/**
 * check:head's stdout carries floor lines measured on a checkout, which would win the dedupe.
 * @type {Record<string, string>}
 */
const FLOOR_OUTPUT_EXCLUDED = {
  "check:head": "its stdout carries the whole tier's floor lines, measured against a checkout rather than disk.",
};

/**
 * Gates a clean checkout cannot run, each with its reason.
 * @type {Record<string, string>}
 */
export const CI_EXCLUDED = {
  /* Bootstrap copies the example, so real equals example and the gate fails in any checkout. */
  "check:config": "cannot pass in any checkout: bootstrap copies the example, so real == example.",
  /* Provisioning a CI D1 would invent the state the backup path is checked against. */
  "check:backup": "needs the gitignored .wrangler/ miniflare state, absent from a checkout.",
  /* Vacuous in CI: there is only HEAD to compare disk against. */
  "check:head": "vacuous in CI: it compares disk to HEAD, and CI has only HEAD.",
  /*
   * Public cases need gitignored local D1 content. Kept off ship: a slow preview boot on a loaded
   * machine would fail a ship for a reason that is not the site.
   */
  "check:browser": "its public cases need gitignored local D1 content; the admin cases are CI-capable via SMOKE_TOKEN. Ruled 2026-09-14: stays on the network tier and the daily schedule, because a preview-server boot past the readiness ceiling on a loaded machine would fail a ship for a reason that is not the site.",
  /* A CI client build would measure a build nothing deploys. */
  "check:page-payload": "reads gitignored build output under build/client; the CI job does not build the client.",
};

/**
 * Every discovered gate must be tiered here or the runner refuses to start.
 *
 * REPORT is the third value and it is not a weaker tier, it is a different job: a report gate is
 * run by name, by a human or by a CI step that does not block, and no tier selects it. It exists
 * because "leaves CI" and "leaves check:all" are different removals, and a gate that is merely
 * moved to network is still run by check:all. Ruling 116.
 *
 * @type {Record<string, "offline" | "network" | "report" | undefined>}
 */
export const TIERS = {
  /*
   * The typecheck is a gate, tiered offline so check:head typechecks an extracted HEAD. It
   * delegates to `npm run typecheck`, which package.json defines.
   */
  /* Report (ruling 116): a decisions volume is a Capsid document, and its length is the seat's
     business rather than a condition on deploying the site. */
  "check:volumes": "report",
  "check:types": "offline",
  "check:content": "offline",
  /* Offline. The network half, `pubs-pipeline`, is never a gate: it would fail on Crossref's bad day. */
  "check:publications": "offline",
  "check:config": "offline",
  "check:search": "offline",
  "check:policy": "offline",
  "check:contrast": "offline",
  /* Offline: reads font binaries and their stylesheets. */
  "check:fonts": "offline",
  /* Reads its inputs off disk, so `--ci` runs it (ruling 111). */
  "check:design-sheets": "offline",
  /* Offline: reads conventions.md and the sheets it names, and renders nothing. Ruling 120's
     first item, because the canvas reads that file every time it designs. */
  "check:design-vocabulary": "offline",
  /* Report (ruling 116). It scores the DIFF rather than the tree, so on the tree its findings
     are false positives, and a score is a preference: 83 of 83 in-scope findings were false
     positives when the audit opened them. The ci.yml step that runs it does not block. */
  "check:slop": "report",
  /* Network: the `updated_at` it compares lives in Capsid (ruling 109). */
  "check:guidelines": "network",
  "check:logo": "offline",
  "check:charts": "offline",
  "check:diagrams": "offline",
  "check:admin-ui": "offline",
  /* Offline because it renders rather than fetches; it needs the stack.json the preflight builds. */
  /* Offline: reads scripts/ as source and runs no wrangler command. */
  "check:d1-address": "offline",
  "check:microformats": "offline",
  "check:urls": "offline",
  // Sees an axis dropped, not wrong SQL.
  "check:media-axes": "offline",
  // Certifies the last local build, stale or not.
  "check:page-payload": "offline",
  // Reads each route's action as SOURCE and proves every destructive intent
  // calls the confirmation predicate inside its own branch. It runs no action,
  // so it sees a guard ABSENT, not a guard present and wrong.
  "check:destructive": "offline",
  /* In CI: a guard's scope change fails silently and permissively. */
  "check:hook-scope": "offline",
  /* In CI: a hook that stops parsing takes the guards with it. */
  "check:hook-syntax": "offline",
  /* In CI it reads only the tracked half of the settings, and says so. */
  "check:hook-matchers": "offline",
  /* Runs the counting gates to read their floors; check:head excludes it. */
  "check:floors": "offline",
  // Reads the tracked example config, package.json and drizzle/. No network.
  "check:stack": "offline",
  // Parses routes.ts and reads gate scripts off disk. No network.
  "check:features": "offline",
  // Reads workers/app.ts and nothing else. It asserts what the SOURCE declares
  // and cannot see the wire; the deployed headers are verify-live's assertions.
  "check:headers": "offline",
  // Cannot see a secret inlined into a client chunk.
  "check:secrets": "offline",
  // Live database drift is check:invariants --remote.
  "check:migrations": "offline",
  // Sees uncommitted work and line endings, never the deployed build.
  "check:head": "offline",
  // node:test over test/. The ONE gate here that asserts BEHAVIOUR rather than
  // the repo's shape: it imports shipped modules and checks what they do with a
  // given input. See test/README.md for the three-instrument split.
  "check:tests": "offline",
  /*
   * Runs the Worker's modules in workerd against local bindings. `test/worker/setup.ts` makes any
   * outbound fetch throw, so offline is enforced.
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
  // No meaningful offline mode: `--local` reads an empty bucket. Network, always.
  /*
   * Network: the preview server's AI_SEARCH binding reaches a real instance. Ship does not run
   * it, so layout defects can ship.
   */
  "check:browser": "network",
  "check:media": "network",
  /* `--local` would read an empty bucket and report a clean sweep. */
  "check:image-weight": "network",
  /* An offline mode could only report that it did not look. */
  "check:uptime": "network",
  /* Report (ruling 116). It returns to a tier at the cutover, which is recorded in CUTOVER.md
     beside the DNS step that makes mail a live path. */
  "check:mail": "report",
  /* A local form would compare two empty databases. Weekly, because it is the slowest gate. */
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
  /* `--remote` adds the cron triggers registered on the platform. */
  "check:config": ["--remote"],
};

const all = process.argv.includes("--all");
/** `--ci` runs the offline tier minus what a clean checkout cannot run. */
const ci = process.argv.includes("--ci");

/** Every `check:*` script package.json declares, minus the runners themselves. */
function discoverGates() {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  /* Shared with build-stack.mjs; excluding the runners stops this one invoking itself. */
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
        `Add each as "offline", "network" or "report". Refusing to run rather than silently ` +
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
   * A gate that could not run is not a gate that failed. The test is both streams empty: every
   * gate here prints on a pass, and an exit-code list missed a real cascade after passing its
   * plant (hard rule 12). An errored gate is still not `ok`.
   */
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const errored = stdout.length === 0 && stderr.length === 0;

  /* The reason reports the disposition; it never decides it. */
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
    /* A number, so the classifier does not parse the reason sentence. */
    status: typeof result.status === "number" ? result.status : null,
    reason: errored ? `wrote nothing to either stream (${seen})` : "",
    ms: Date.now() - started,
    output: `${stdout}${stderr}`,
    /*
     * Filled in by the caller. Null means not sampled, not zero.
     * @type {number | null}
     */
    peakRss: /** @type {number | null} */ (null),
  };
}

/*
 * Environment failure: one machine fact, not N repo facts. All four must hold: both streams
 * empty (the only condition that keeps a real failure out), an NTSTATUS-range status, under one
 * second, and more than one gate with that status. It changes the exit code (2), never the
 * verdict. A classifier that calls everything the machine is hard rule 10's unfailable class.
 */
const NTSTATUS_FAILURE_FLOOR = 0xc0000000;
const ENVIRONMENT_MAX_MS = 1000;

/**
 * Known on this host; anything else prints as bare hex.
 * @type {Record<number, string>}
 */
const NTSTATUS_NAMES = {
  0xc0000005: "STATUS_ACCESS_VIOLATION",
  0xc0000017: "STATUS_NO_MEMORY",
  0xc0000142: "STATUS_DLL_INIT_FAILED",
};

/** @param {number} status */
export function ntstatusName(status) {
  const name = NTSTATUS_NAMES[status];
  return `0x${status.toString(16).toUpperCase()}${name ? ` ${name}` : ""}`;
}

/**
 * @param {Array<{name: string, errored: boolean, status: number | null, ms: number}>} results
 * @returns {{status: number, names: string[]} | null} the correlated group, or
 *   null when nothing in this run meets all four conditions.
 */
export function classifyEnvironmentFailure(results) {
  const candidates = results.filter(
    (r) =>
      r.errored === true &&
      typeof r.status === "number" &&
      r.status >= NTSTATUS_FAILURE_FLOOR &&
      typeof r.ms === "number" &&
      r.ms < ENVIRONMENT_MAX_MS,
  );

  /** @type {Map<number, string[]>} */
  const byStatus = new Map();
  for (const r of candidates) {
    const status = /** @type {number} */ (r.status);
    if (!byStatus.has(status)) byStatus.set(status, []);
    /** @type {string[]} */ (byStatus.get(status)).push(r.name);
  }

  /** @type {{status: number, names: string[]} | null} */
  let group = null;
  for (const [status, names] of byStatus) {
    // Condition 4. A single gate is not a machine fact, however it died.
    if (names.length < 2) continue;
    if (group === null || names.length > group.names.length) group = { status, names };
  }
  return group;
}

function main() {
  const gates = discoverGates();

  /* Built first: `build:content` reads stack.json. Not a gate. */
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
   * Built before any gate reads it (posts.json is gitignored), and refused here: a broken build
   * is not a red gate.
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
  /* Gitignored; check:publications compares it against a fresh generation. */
  process.stdout.write("  build:publication-twins (the twins check:publications compares) ... ");
  const twinned = runGate("build:publication-twins", []);
  if (!twinned.ok) {
    console.log("FAILED");
    console.log(twinned.output.trimEnd());
    throw new Error(
      "build:publication-twins failed, so the markdown twins do not exist on " +
        "disk. Nothing below ran; fix the twin build first.",
    );
  }
  console.log(`ok (${(twinned.ms / 1000).toFixed(1)}s)`);
  /* Gitignored; the app build's `?url` imports need them. */
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
  /* Derived, so a new gate is in CI unless argued out. */
  const offline = gates.filter((name) => TIERS[name] === "offline");
  /* A report gate is selected by no tier, which is the whole of what the value means. */
  const reported = gates.filter((name) => TIERS[name] === "report");
  const selected = all
    ? gates.filter((name) => TIERS[name] !== "report")
    : ci
      ? offline.filter((name) => !CI_EXCLUDED[name])
      : offline;
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
    /*
     * APPLIED, not declared. Printing every CI_EXCLUDED key named entries that could not have
     * been excluded here because they were never in the offline tier to be removed from, which
     * reads as a longer exclusion list than the run actually had.
     */
    const applied = offline.filter((name) => CI_EXCLUDED[name]);
    console.log(
      `  CI tier: ${selected.length} of ${offline.length} offline gate(s). ` +
        `Excluded, with reasons in CI_EXCLUDED: ${applied.join(", ")}`,
    );
  }

  if (reported.length > 0) {
    console.log(`  report tier, run by name and by no tier: ${reported.join(", ")}`);
  }

  console.log(
    `\n${all ? "check:all" : "check"} running ${selected.length} of ${gates.length} gate(s)` +
      `${all ? " (offline + network)" : " (offline tier)"}\n`,
  );

  /*
   * Preflight: tree-kill what the previous run left alive. By pid, never by name: a name match
   * for `node` or `chrome` reaches Dustin's own editor and browser.
   */
  const recorded = treeSince(RSS_FILE).filter((pid) => pid !== process.pid);
  if (recorded.length > 0) {
    /* One process table read: a `taskkill` per dead pid makes later gates fail to start. */
    const table = readProcessTable();
    const leftovers = recorded.filter((pid) => table.has(pid));
    let reaped = 0;
    for (const pid of leftovers) if (killTree(pid)) reaped += 1;
    console.log(
      `  preflight: ${recorded.length} process(es) recorded by the previous run, ` +
        `${leftovers.length} still alive, ${reaped} reaped\n`,
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

  /** Kills this run's tree on exit and signals; an OS kill is covered by the next preflight. */
  let cleanedUp = false;
  const cleanUp = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    const table = readProcessTable();
    const alive = treeSince(RSS_FILE).filter(
      (pid) => pid !== process.pid && pid !== sampler.pid && table.has(pid),
    );
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
  /* Runs last and reads the captured output instead of re-running the tier. */
  const readsFloorLines = selected.includes(FLOOR_READER);
  const spawnable = selected.filter((name) => name !== FLOOR_READER);

  for (const name of spawnable) {
    // JUSTIFIED SUBSTITUTION (hard rule 13). Partial on purpose: absence means no extra args.
    const args = all ? (REMOTE_ARGS[name] ?? []) : [];
    process.stdout.write(`  ${name}${args.length ? ` ${args.join(" ")}` : ""} ... `);
    // EVERY gate runs, including after a failure. Stopping at the first red hides
    // every gate behind it, which is how one failure masks a second.
    const from = Date.now();
    const result = runGate(name, args);
    /* Closes after the gate returns, so its dying children count against it. */
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
   * Fed only passing gates' output; `gates` is passed separately because a silent gate leaves no
   * trace in the text.
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
      status: typeof spawned.status === "number" ? spawned.status : null,
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

  // Failing output in full, after the run, where it is read.
  for (const result of failed) {
    console.log(`\n${"=".repeat(72)}\n${result.name}\n${"=".repeat(72)}`);
    console.log(result.output.trimEnd());
  }

  /* Correlated first, so one machine event is not buried under its own banners. */
  const environment = classifyEnvironmentFailure(results);
  const environmentNames = new Set(environment ? environment.names : []);

  // Errored gates get their own block; a correlated event is listed once under its banner.
  for (const result of errored.filter((r) => !environmentNames.has(r.name))) {
    console.log(`\n${"=".repeat(72)}\n${result.name}  (ERRORED, no verdict)\n${"=".repeat(72)}`);
    console.log(`  ${result.reason}`);
    /* An errored gate has no output by definition; a branch for it could not fire (hard rule 10). */
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

  /* Peak memory and the gate holding it are what an out-of-memory kill needs. */
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
  if (environment) {
    console.log(
      `  ENVIRONMENT FAILURE, not a repo failure. ${environment.names.length} gate(s) exited\n` +
        `  ${ntstatusName(environment.status)} in under a second having written NOTHING to\n` +
        "  either stream, which is a process that never reached main. That is ONE fact\n" +
        "  about this machine, not one per gate: no gate named below reported on its\n" +
        "  subject, in either direction, so this run covers nothing at all.\n" +
        `  ${environment.names.join(", ")}\n` +
        "  The usual cause is concurrent spawn on a saturated machine. Re-run the tier;\n" +
        "  if it reproduces, that is a queued item about the host, not an investigation\n" +
        "  into any gate named above.\n",
    );
  }
  if (errored.length > environmentNames.size) {
    const rest = errored.filter((r) => !environmentNames.has(r.name));
    console.log(
      `  ${rest.length} gate(s) ERRORED: ${rest.map((r) => r.name).join(", ")}.\n` +
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

  // An errored run exits nonzero: a ship must never read "0 failed" off it.
  /*
   * Exit code set, not taken: process.exit() can cut the report short. cleanUp() is explicit
   * because the live sampler would keep the exit handler from ever running.
   */
  cleanUp();
  /* Two is the machine, one is the repo; a real failure outranks an environment event. */
  process.exitCode =
    failed.length > 0 ? 1 : environment ? 2 : errored.length > 0 ? 1 : 0;
}

/*
 * Main guard, so check:floors can import `TIERS`. `pathToFileURL`, because a hand-built
 * `file://C:\...` URL never equals import.meta.url on Windows.
 */
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main();
  } catch (error) {
    console.error(`\ncheck failed to start. ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
