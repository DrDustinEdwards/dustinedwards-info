import { errorMessage } from "@dustinedwards/site-runtime/log";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { gateNames } from "./build-stack.mjs";
import { spawn, spawnSync } from "node:child_process";
import { availableParallelism } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertFloor } from "@dustinedwards/devkit/node";
import { killTree, readProcessTable, recordedTreeLeftovers } from "./lib/child-processes.mjs";
import { WINDOWS_CRASH_CODES } from "./lib/windows-crash-codes.mjs";
import { mb, peakBetween, startRssSampler, treeSince } from "./lib/rss.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Read before truncation: after an OS kill the previous run's samples are its only record. */
const RSS_FILE = join(root, ".gate-pids", "check-all-rss.csv");

/** Fails closed below this. Moves only to the count a run printed, never to a sum. */
const MINIMUM_GATES = 19;

/** @type {Record<string, string>} */
export const CI_EXCLUDED = {
  /* Provisioning a CI D1 would invent the state the backup path is checked against. */
  "check:backup": "needs the gitignored .wrangler/ miniflare state, absent from a checkout.",
  /* Needs gitignored local D1 content. Kept off ship: a slow preview boot on a loaded machine would
     fail a ship for a reason that is not the site. */
  "check:browser":
    "its public cases need gitignored local D1 content; the admin cases are CI-capable via SMOKE_TOKEN. Ruled 2026-09-14: stays on the network tier and the daily schedule, because a preview-server boot past the readiness ceiling on a loaded machine would fail a ship for a reason that is not the site.",
  "check:systems-map":
    "boots a preview server and a browser, ruled off the clean checkout with check:browser (2026-09-14); .github/workflows/systems-map.yml runs it on each pull request that touches the map.",
};

/** @type {Record<string, "offline" | "network" | undefined>} */
export const TIERS = {
  "check:types": "offline",
  "check:tests": "offline",
  // Offline: test/worker/setup.ts makes any outbound fetch throw.
  "check:worker": "offline",
  "check:content": "offline",
  "check:machine-readable": "offline",
  "check:features": "offline",
  "check:protocols": "offline",
  "check:fonts": "offline",
  "check:postinstall": "offline",
  "check:diagrams": "offline",
  "check:contrast": "offline",
  "check:secrets": "offline",
  "check:migrations": "offline",
  // The console.* ratchet (devkit-console, .console.json): raw calls in server code may only go down.
  "check:console": "offline",
  "check:policy": "offline",
  "check:ask-guards": "offline",
  "check:test-assertions": "offline",
  "check:enhance-a11y": "offline",
  // Offline: the renderer takes alt from the reference alone, never from the media index in D1.
  "check:alt-text": "offline",
  "check:urls": "offline",
  // Offline: the address book is built from the sources, never from D1, R2 or the network.
  "check:links": "offline",
  "check:destructive": "offline",
  "check:backup": "offline",
  // Network: the preview server's AI_SEARCH binding reaches a real instance.
  "check:browser": "network",
  // Network for check:browser's reason: a preview boot. Its own workflow runs it on each pull request that touches the map.
  "check:systems-map": "network",
};

/** @type {Record<string, string[] | undefined>} */
const REMOTE_ARGS = {
  "check:backup": ["--remote"],
  "check:machine-readable": ["--remote"],
};

const all = process.argv.includes("--all");
const ci = process.argv.includes("--ci");

/*
 * How many gates run at once. CI runs them side by side, as many as the runner has cores: run one after another, the
 * Gates step took about 230 s of gate time, 152 s of it check:worker, while the runner's other cores idled. The local tier
 * and ship stay one at a time unless `--jobs N` asks: there the RSS sampler gives each gate its own peak, which overlap
 * would blur, and the machine is Dustin's, where concurrent spawn on a saturated host is the one environment failure
 * classifyEnvironmentFailure below exists to name.
 */
const jobsArg = process.argv.indexOf("--jobs");
const JOBS = Math.max(
  1,
  jobsArg >= 0 ? Number(process.argv[jobsArg + 1]) || 1 : ci ? availableParallelism() : 1,
);

/* The slow gates start first, so the short ones fill the cores beside them instead of a slow one starting last. An
   order, not a list of gates: a gate missing here still runs, after these. */
const SLOW_FIRST = ["check:worker", "check:tests", "check:types"];

function discoverGates() {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  /* Excluding the runners stops this one invoking itself. */
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

/**
 * Exported so `check:changed` spawns a gate exactly as this does: the shell behavior is
 * Windows-specific and measured, and a second copy would be a second thing to get wrong.
 * @param {string} name @param {string[]} args
 */
export function runGate(name, args) {
  const started = Date.now();
  const result = spawnSync(gateCommand(name, args), {
    cwd: root,
    encoding: "utf8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  return gateResult(name, started, result);
}

/** @param {string} name @param {string[]} args */
const gateCommand = (name, args) => `npm run ${name}${args.length ? ` -- ${args.join(" ")}` : ""}`;

/** @type {Set<import("node:child_process").ChildProcess>} */
const running = new Set();

/**
 * runGate without blocking, so several gates run at once. The same command, shell and result.
 * @param {string} name @param {string[]} args @returns {Promise<ReturnType<typeof runGate>>}
 */
function runGateAsync(name, args) {
  const started = Date.now();
  return new Promise((resolve) => {
    /** @type {Buffer[]} */
    const out = [];
    /** @type {Buffer[]} */
    const err = [];
    /** @type {Error | undefined} */
    let error;
    const child = spawn(gateCommand(name, args), {
      cwd: root,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    running.add(child);
    child.stdout.on("data", (chunk) => out.push(chunk));
    child.stderr.on("data", (chunk) => err.push(chunk));
    child.on("error", (e) => (error = e));
    child.on("close", (status, signal) => {
      running.delete(child);
      resolve(
        gateResult(name, started, {
          stdout: Buffer.concat(out).toString("utf8"),
          stderr: Buffer.concat(err).toString("utf8"),
          status,
          signal,
          error,
        }),
      );
    });
  });
}

/**
 * @param {string} name @param {number} started
 * @param {{ stdout?: string | null, stderr?: string | null, status: number | null, signal?: NodeJS.Signals | null, error?: Error }} result
 */
function gateResult(name, started, result) {
  /* A gate that could not run is not a gate that failed. Both streams empty is the test, because every
     gate here prints on a pass. */
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const errored = stdout.length === 0 && stderr.length === 0;

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
    status: typeof result.status === "number" ? result.status : null,
    reason: errored
      ? `wrote nothing to either stream (${seen})`
      : result.status !== 0 || result.error
        ? seen
        : "",
    ms: Date.now() - started,
    output: `${stdout}${stderr}`,
    /*
     * Null means not sampled, not zero.
     * @type {number | null}
     */
    peakRss: /** @type {number | null} */ (null),
  };
}

/*
 * Environment failure needs all four: both streams empty (the condition that keeps a real failure out),
 * an NTSTATUS-range status, under one second, and more than one gate with that status.
 */
const NTSTATUS_FAILURE_FLOOR = 0xc0000000;
const ENVIRONMENT_MAX_MS = 1000;

/** @param {number} status */
export function ntstatusName(status) {
  // The one table of crash codes, so a crash is never named as a red gate.
  const name = WINDOWS_CRASH_CODES.get(status);
  return `0x${status.toString(16).toUpperCase()}${name ? ` ${name}` : ""}`;
}

/**
 * @param {Array<{name: string, errored: boolean, status: number | null, ms: number}>} results
 * @returns {{status: number, names: string[]} | null}
 */
function classifyEnvironmentFailure(results) {
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
    if (names.length < 2) continue;
    if (group === null || names.length > group.names.length) group = { status, names };
  }
  return group;
}

/**
 * The runner that owned the recorded tree, from the marker line written at truncation.
 * @returns {number | null}
 */
function recordedRunner() {
  try {
    const m = /^# runner (\d+)$/m.exec(readFileSync(RSS_FILE, "utf8"));
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

/**
 * The build products the gates read, in order. A failed one is refused here, before any gate reads
 * it: a broken build is not a red gate.
 * @type {Array<{ name: string, what: string, missing: string }>}
 */
const PREREQS = [
  /* Built first: `build:content` reads stack.json. */
  {
    name: "build:stack",
    what: "the colophon artifact build:content reads",
    missing:
      "build:stack failed, so content/generated/stack.json does not exist on disk. " +
      "Nothing below ran; fix the stack build first.",
  },
  {
    name: "build:content",
    what: "the local build product the tier reads",
    missing:
      "build:content failed, so the tier's subject does not exist on disk. " +
      "Nothing below ran; fix the build first.",
  },
];

function buildPrereqs() {
  for (const prereq of PREREQS) {
    process.stdout.write(`  ${prereq.name} (${prereq.what}) ... `);
    const built = runGate(prereq.name, []);
    if (!built.ok) {
      console.log("FAILED");
      console.log(built.output.trimEnd());
      throw new Error(prereq.missing);
    }
    console.log(`ok (${(built.ms / 1000).toFixed(1)}s)`);
  }
}

/*
 * By pid and parentage, never by name: a name match for `node` or `chrome` reaches Dustin's own
 * editor and browser, and a pid alone may have been reused since it was recorded.
 */
function reapOrphans() {
  const recorded = treeSince(RSS_FILE).filter((pid) => pid !== process.pid);
  if (recorded.length > 0) {
    /* One process table read: a `taskkill` per dead pid makes later gates fail to start. */
    const table = readProcessTable();
    const runner = recordedRunner();
    const runnerLive = runner === null ? undefined : table.get(runner);
    if (table.size === 0) {
      console.log(
        `  preflight: ${recorded.length} process(es) recorded by the previous run, but the process ` +
          "table could not be read, so none was killed on its pid alone\n",
      );
    } else if (runnerLive && runnerLive.command.includes("check-all.mjs")) {
      console.log(
        `  preflight: the run that recorded these (pid ${runner}) is still running, so its tree ` +
          "was left alone\n",
      );
    } else {
      const leftovers = recordedTreeLeftovers(recorded, table, runner);
      let reaped = 0;
      for (const pid of leftovers) if (killTree(pid)) reaped += 1;
      console.log(
        `  preflight: ${recorded.length} process(es) recorded by the previous run, ` +
          `${leftovers.length} still alive under that run's tree, ${reaped} reaped\n`,
      );
    }
  }
}

/**
 * Runs every selected gate under the RSS sampler, and installs the cleanup that kills this run's tree.
 * @param {string[]} selected
 */
function runSelected(selected) {
  /* `spawnSync` blocks this event loop for the whole of every gate, so the sampler is a separate
     process writing to a file. */
  mkdirSync(join(root, ".gate-pids"), { recursive: true });
  writeFileSync(RSS_FILE, `# runner ${process.pid}\n`);
  const sampler = startRssSampler(RSS_FILE);

  /** Kills this run's tree on exit and signals; an OS kill is covered by the next preflight. */
  let cleanedUp = false;
  const cleanUp = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    const table = readProcessTable();
    const alive = recordedTreeLeftovers(
      treeSince(RSS_FILE).filter((pid) => pid !== sampler.pid),
      table,
      process.pid,
    );
    for (const pid of alive) killTree(pid);
    for (const child of running) child.kill();
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
  if (JOBS > 1)
    return runConcurrently(selected).then((done) => ({ results: done, sampler, cleanUp }));
  for (const name of selected) {
    const args = all ? (REMOTE_ARGS[name] ?? []) : [];
    process.stdout.write(`  ${name}${args.length ? ` ${args.join(" ")}` : ""} ... `);
    // Every gate runs even after a failure: stopping at the first red lets one failure mask a second.
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
  return Promise.resolve({ results, sampler, cleanUp });
}

/**
 * Up to JOBS gates at once. Each gate's line prints when it finishes, whole, so no two gates' words interleave; a
 * failed gate's output is printed by summarize, in the declared order, as in a serial run. Peak memory is per gate only
 * when nothing overlaps it, so it is not attributed here.
 * @param {string[]} selected
 */
async function runConcurrently(selected) {
  const queue = [
    ...SLOW_FIRST.filter((name) => selected.includes(name)),
    ...selected.filter((name) => !SLOW_FIRST.includes(name)),
  ];
  console.log(
    `  ${JOBS} at a time (--jobs, or the runner's cores under --ci); each gate's line prints when it finishes\n`,
  );
  /** @type {Map<string, ReturnType<typeof runGate>>} */
  const done = new Map();
  const worker = async () => {
    for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
      const args = all ? (REMOTE_ARGS[name] ?? []) : [];
      // Every gate runs even after a failure: stopping at the first red lets one failure mask a second.
      const result = await runGateAsync(name, args);
      done.set(name, result);
      const seconds = (result.ms / 1000).toFixed(1);
      console.log(
        `  ${name}${args.length ? ` ${args.join(" ")}` : ""} ... ` +
          (result.errored
            ? `ERRORED (${seconds}s) ${result.reason}`
            : result.ok
              ? `ok (${seconds}s)`
              : `FAILED (${seconds}s)`),
      );
    }
  };
  await Promise.all(Array.from({ length: Math.min(JOBS, selected.length) }, worker));
  return selected.map((name) => /** @type {ReturnType<typeof runGate>} */ (done.get(name)));
}

/**
 * Prints the failed gates' output, the result table and the verdict lines.
 * @param {ReturnType<typeof runGate>[]} results
 * @param {string[]} skipped
 * @param {{ available: boolean }} sampler
 */
function summarize(results, skipped, sampler) {
  // An errored gate produced no verdict: calling it a failure invents one, calling it a pass hides one.
  const errored = results.filter((r) => r.errored);
  const failed = results.filter((r) => !r.ok && !r.errored);

  for (const result of failed) {
    console.log(`\n${"=".repeat(72)}\n${result.name}\n${"=".repeat(72)}`);
    console.log(result.output.trimEnd());
  }

  const environment = classifyEnvironmentFailure(results);
  const environmentNames = new Set(environment ? environment.names : []);

  for (const result of errored.filter((r) => !environmentNames.has(r.name))) {
    console.log(`\n${"=".repeat(72)}\n${result.name}  (ERRORED, no verdict)\n${"=".repeat(72)}`);
    console.log(`  ${result.reason}`);
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
    const why =
      TIERS[name] === "offline" && ci && CI_EXCLUDED[name]
        ? "excluded from CI, see CI_EXCLUDED"
        : "needs the network, run: npm run check:all";
    console.log(`  SKIP  ${name.padEnd(18)} ${why}`);
  }
  console.log(`${"-".repeat(52)}`);

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
        "  An errored gate asserted NOTHING about its subject, in either direction. It is\n" +
        "  not a red gate and it is not a green one, so this run does not cover what it\n" +
        "  would have covered. Re-run those gates alone before reading anything into them:\n" +
        "  the usual cause is a saturated machine, not a defect.\n",
    );
  }

  if (!all) {
    console.log(
      "  NOT COVERED by this tier: check:backup, check:machine-readable and the schema\n" +
        "  test against the remote database. `npm run check:all` adds them. Neither tier\n" +
        "  covers verify-live, which needs a deploy.\n",
    );
  }
  return { failed, errored, environment };
}

async function main() {
  /* The schema test compares the live database only when asked; every spawned gate inherits this. */
  if (all) process.env.SCHEMA_LIVE = "1";
  const gates = discoverGates();

  buildPrereqs();

  const offline = gates.filter((name) => TIERS[name] === "offline");
  const selected = all ? gates : ci ? offline.filter((name) => !CI_EXCLUDED[name]) : offline;
  const skipped = gates.filter((name) => !selected.includes(name));

  if (ci) {
    /* An exclusion naming a gate nobody declares would silently exclude nothing and report a full CI
       run while being the plain offline tier. */
    const unknown = Object.keys(CI_EXCLUDED).filter((name) => !gates.includes(name));
    if (unknown.length > 0) {
      throw new Error(
        `CI_EXCLUDED names ${unknown.length} gate(s) package.json does not declare: ` +
          `${unknown.join(", ")}. Refusing to run rather than excluding nothing.`,
      );
    }
    const applied = offline.filter((name) => CI_EXCLUDED[name]);
    console.log(
      `  CI tier: ${selected.length} of ${offline.length} offline gate(s). ` +
        `Excluded, with reasons in CI_EXCLUDED: ${applied.join(", ")}`,
    );
  }

  console.log(
    `\n${all ? "check:all" : "check"} running ${selected.length} of ${gates.length} gate(s)` +
      `${all ? " (offline + network)" : " (offline tier)"}\n`,
  );

  reapOrphans();

  const { results, sampler, cleanUp } = await runSelected(selected);
  const { failed, errored, environment } = summarize(results, skipped, sampler);

  /*
   * Exit code set, not taken: process.exit() can cut the report short. cleanUp() is explicit
   * because the live sampler would keep the exit handler from ever running.
   */
  cleanUp();
  /* Two is the machine, one is the repo; a real failure outranks an environment event. */
  process.exitCode = failed.length > 0 ? 1 : environment ? 2 : errored.length > 0 ? 1 : 0;
}

/*
 * Main guard, so check:changed can import `TIERS`. `pathToFileURL`, because a hand-built
 * `file://C:\...` URL never equals import.meta.url on Windows.
 */
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(`\ncheck failed to start. ${errorMessage(error)}\n`);
    process.exit(1);
  });
}
