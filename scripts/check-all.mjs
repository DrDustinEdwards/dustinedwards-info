import { errorMessage } from "@dustinedwards/site-runtime/log";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { assertFloor } from "@dustinedwards/devkit/node";
import { gateNames } from "./build-stack.mjs";
import { killTree, readProcessTable, recordedTreeLeftovers } from "./lib/child-processes.mjs";
import { mb, peakBetween, startRssSampler, treeSince } from "./lib/rss.mjs";
import { RSS_FILE, buildPrereqs, reapOrphans } from "./lib/gate-preflight.mjs";
import {
  classifyEnvironmentFailure,
  ntstatusName,
  root,
  runGate,
  runGateAsync,
  running,
} from "./lib/gate-run.mjs";
import { CI_EXCLUDED, REMOTE_ARGS, TIERS } from "./lib/gate-tiers.mjs";

/** Fails closed below this. Moves only to the count a run printed, never to a sum. */
const MINIMUM_GATES = 20;

export const all = process.argv.includes("--all");
const ci = process.argv.includes("--ci");

/*
 * Gates at once: CI runs as many as it has cores; local and ship run one at a time unless `--jobs N`,
 * because the RSS sampler attributes a peak per gate only when nothing overlaps it, and concurrent
 * spawn on a saturated host is the environment failure classifyEnvironmentFailure names.
 */
const jobsArg = process.argv.indexOf("--jobs");
const JOBS = Math.max(
  1,
  jobsArg >= 0 ? Number(process.argv[jobsArg + 1]) || 1 : ci ? availableParallelism() : 1,
);

/* An order, not a list: a gate missing here still runs, after these, so the short ones fill the cores beside the slow. */
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
 * Up to JOBS gates at once. A gate's line prints whole when it finishes; a failed gate's output is
 * printed by summarize in declared order.
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
      "  NOT COVERED by this tier: check:backup, check:content's llms.txt row and the schema\n" +
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

main().catch((error) => {
  console.error(`\ncheck failed to start. ${errorMessage(error)}\n`);
  process.exit(1);
});
