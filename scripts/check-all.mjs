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
const MINIMUM_GATES = 24;

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
  // Reads the tracked example config, package.json and drizzle/. No network.
  "check:stack": "offline",
  // Parses routes.ts and reads gate scripts off disk. No network.
  "check:features": "offline",
  // Reads workers/app.ts and nothing else. It asserts what the SOURCE declares
  // and cannot see the wire; the deployed headers are verify-live's assertions.
  "check:headers": "offline",
  // Reads CLAUDE.md as bytes and asserts its SHAPE: that it fits inside the
  // context-window truncation limit, and that the hard-rules pointer sits early
  // enough to be read. It cannot tell whether a word of it is true.
  "check:claude-md": "offline",
  // Reads source text under app/ and workers/ and asserts the secret-handling
  // boundary. It cannot see the emitted bundle, so a secret inlined into a
  // client chunk by a mis-split is invisible here; the header says so.
  "check:secrets": "offline",
  // Lints the OTHER gate scripts for assertions that cannot fail. Reads source
  // text under scripts/ and nothing else. It proves an assertion is DELIMITED,
  // never that the delimitation is the right one; that judgement stays human.
  "check:assertions": "offline",
  // Parses .claude/settings.json and asserts the hook wiring. It reads a file:
  // it cannot see whether Claude Code LOADED that file, whether a user-level
  // settings file overrode it, or whether any hook actually ran. A green run is
  // compatible with enforcement being entirely off. It never writes.
  "check:hooks": "offline",
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

/** Every `check:*` script package.json declares, minus the runners themselves. */
function discoverGates() {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const names = Object.keys(pkg.scripts ?? {})
    .filter((name) => name.startsWith("check:"))
    // The aggregate runners are not gates. Without this the runner invokes
    // itself, forever.
    .filter((name) => name !== "check:all")
    .sort();

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
  const selected = all ? gates : gates.filter((name) => TIERS[name] === "offline");
  const skipped = gates.filter((name) => !selected.includes(name));

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
