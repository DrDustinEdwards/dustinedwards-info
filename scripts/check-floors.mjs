/**
 * Gate: no floor has drifted far under the count it is supposed to floor.
 *
 *   npm run check:floors
 *
 * BOUNDARY: it compares two numbers a gate PRINTS, so it cannot tell whether the count is honest,
 * which is hard rule 10's half, and it cannot see a gate with NO floor, which is why the absences
 * are named here. It READS under `check:all` and RUNS standalone, and reading from a pipe rather
 * than a stored log is what keeps hard rule 10's fixture independence.
 */

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { gateNames } from "./build-stack.mjs";
import { CI_EXCLUDED, TIERS } from "./check-all.mjs";
import { FLOOR_LINE } from "./lib/floor.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * How far under its count a floor may sit. WHY A PERCENTAGE: it must absorb ordinary growth or it
 * becomes a number people bump reflexively. WHY A FLAT MINIMUM UNDER IT: a percentage of a small
 * count rounds to nothing. They combine as a MAXIMUM. The example that stood here is gone:
 * restating another gate's count made this comment go stale three times over.
 */
export const FLOOR_TOLERANCE = (/** @type {number} */ executed) =>
  Math.max(3, Math.ceil(executed * 0.05));

/**
 * Gates that carry NO floor, each with the reason, so an absence is argued rather than
 * accumulated: a reader can tell "no floor line because there is no floor" from "because the
 * floor stopped executing".
 *
 * @type {Record<string, string>}
 */
const UNFLOORED = {
  "check:types": "delegates wholly to tsc -b, which owns its own reporting.",
  "check:content": "carries two scope floors on files and assets walked.",
  /*
   * NETWORK TIER, so a standalone offline run never reaches it and only the
   * check:all read sees it at all. Its floor is a scope proof on reconciled
   * objects, not an executed count.
   */
  "check:media": "carries a scope floor on reconciled objects, not an executed-count floor.",
  /*
   * OFFLINE TIER, contrary to the obvious guess: it defaults to local, so it IS run from here. Its
   * floors are on TABLE COUNTS, which are scope proofs rather than executed counts.
   */
  "check:backup": "carries four scope floors on table counts, not an executed-count floor.",
  "check:image-weight": "asserts per-row and reports rows examined; no executed-count floor.",
  /*
   * Its two floors are on BUILT CHUNKS and FILES WALKED, which are scope proofs. The chunk one
   * sits far under its count, which reads as drift and is not: the count is a property of the
   * bundler's splitting on the day.
   */
  "check:page-payload": "carries scope floors on built chunks and files walked, not executed counts.",
};

/**
 * Gates this one does not run, each with a measured reason.
 *
 * @type {Record<string, string>}
 */
const NOT_RUN = {
  /*
   * RECURSION, and the expensive kind: that gate runs the whole offline tier inside an extraction
   * and this gate is IN it. Nothing is lost, its floor lines belonging to CHILD gates run here.
   */
  "check:head": "recursion: it re-runs the offline tier, which contains this gate.",
  "check:floors": "itself.",
};

console.log("\ncheck:floors\n");

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

/*
 * THE GATE LIST IS DERIVED, from the same `gateNames` check:all uses, so a gate
 * added to package.json and forgotten here shows up as an unread floor rather
 * than as silence.
 */
/*
 * THE OFFLINE TIER ONLY, a correctness constraint rather than a speed one: this gate is tiered
 * OFFLINE, so running every discovered gate would reach a NETWORK ONLY one and the tier would
 * acquire a network dependency through the gate whose job is reading other gates.
 */
/*
 * AND IN CI, THE OFFLINE TIER MINUS WHAT CI CANNOT RUN, or this gate fails for reasons that have
 * nothing to do with any floor. Detected the way CI announces itself rather than by a flag.
 */
const inCI = Boolean(process.env.CI);

/**
 * Every floor line in one gate's output. The gate NAME comes off the line rather than from
 * whoever produced the text, which is what makes reading a concatenated run safe.
 *
 * @param {string} output
 * @returns {{ gate: string, name: string, executed: number, minimum: number }[]}
 */
function floorLinesIn(output) {
  const found = [];
  for (const line of output.split("\n")) {
    const match = FLOOR_LINE.exec(line.trim());
    if (!match) continue;
    found.push({
      gate: match[1],
      name: match[2],
      executed: Number(match[3]),
      minimum: Number(match[4]),
    });
  }
  return found;
}

/*
 * TWO WAYS IN, AND THE CHEAP ONE IS THE DEFAULT UNDER `check:all`, which has already captured
 * every gate's stdout: re-running them cost the whole offline tier a second time per ship. THE
 * GATE LIST TRAVELS WITH THE OUTPUT and is not derivable from it, a gate that printed nothing
 * being invisible in a concatenation of what was printed. NOT THE STORED-LOG SHAPE THIS HEADER
 * REJECTS: that reads an artifact a PREVIOUS run left on disk.
 */
const fromStdin = process.argv.includes("--from-stdin");

/** @type {{ gate: string, name: string, executed: number, minimum: number }[]} */
const floors = [];
/** @type {string[]} */
const silent = [];
/** @type {string[]} */
let gates = [];

if (fromStdin) {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, "utf8"));
  } catch (error) {
    console.log(
      `  FAIL  --from-stdin was passed and the payload could not be read: ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
    console.log("        Refusing rather than falling back to re-running the gates: a silent\n" +
      "        fallback would hide the wiring breaking and cost the tier twice.\n");
    process.exit(1);
  }
  gates = Array.isArray(payload?.gates) ? payload.gates : [];
  const output = typeof payload?.output === "string" ? payload.output : "";

  if (gates.length === 0 || output.length === 0) {
    console.log("  FAIL  the piped payload named no gates or carried no output.");
    console.log("        Every assertion below would pass by reading nothing.\n");
    process.exit(1);
  }

  console.log(`  reading ${gates.length} gate(s) already run by check:all\n`);

  const found = floorLinesIn(output);
  floors.push(...found);
  const producers = new Set(found.map((f) => f.gate));
  for (const gate of gates) {
    if (!producers.has(gate) && !UNFLOORED[gate]) silent.push(gate);
  }
} else {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  gates = gateNames(pkg).filter(
    (name) =>
      !NOT_RUN[name] && TIERS[name] === "offline" && !(inCI && CI_EXCLUDED[name]),
  );

  if (gates.length === 0) {
    console.log("  FAIL  no gates discovered. Every assertion below would pass by running nothing.\n");
    process.exit(1);
  }

  console.log(`  running ${gates.length} gate(s) for their floor lines\n`);

  for (const gate of gates) {
    const result = spawnSync(`npm run -s ${gate}`, {
      cwd: root,
      encoding: "utf8",
      shell: true,
      maxBuffer: 64 * 1024 * 1024,
    });
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

    /*
     * A GATE THAT FAILED IS NOT A FLOOR READING: its lines came from a run that had already refused.
     * The pipe path needs no equivalent, the tier reporting a failing gate in its own table.
     */
    if (result.status !== 0) {
      ok(
        `${gate} passed, so its floor lines are readable`,
        false,
        `it exited ${result.status}. check:floors cannot read a floor from a run that ` +
          `refused; fix that gate first, then re-run this one.`,
      );
      continue;
    }

    const found = floorLinesIn(output);
    if (found.length === 0 && !UNFLOORED[gate]) silent.push(gate);
    floors.push(...found);
  }
}

/*
 * DEDUPED ON gate:name: a floor line names the gate that produced it rather than the process that
 * printed it, so the same floor read twice is one floor.
 */
/** @type {Map<string, { gate: string, name: string, executed: number, minimum: number }>} */
const unique = new Map();
for (const floor of floors) unique.set(`${floor.gate}:${floor.name}`, floor);

console.log("\n  1. no floor has drifted under its count\n");

for (const floor of [...unique.values()].sort((a, b) =>
  `${a.gate}:${a.name}`.localeCompare(`${b.gate}:${b.name}`),
)) {
  const gap = floor.executed - floor.minimum;
  const tolerance = FLOOR_TOLERANCE(floor.executed);
  const within = gap <= tolerance;
  console.log(
    `  ${within ? "ok  " : "FAIL"}  ${`${floor.gate}:${floor.name}`.padEnd(34)} ` +
      `executed=${String(floor.executed).padEnd(5)} minimum=${String(floor.minimum).padEnd(5)} ` +
      `gap=${String(gap).padEnd(4)} tolerance=${tolerance}`,
  );
  ok(
    `${floor.gate}:${floor.name} floor is within tolerance of its count`,
    within,
    `the floor is ${gap} under the count and the tolerance is ${tolerance}. ` +
      `${gap} assertion(s) could stop running and this floor would still pass. ` +
      `RE-MEASURE by running ${floor.gate} and set its minimum from the printed ` +
      `count, never by arithmetic on the old floor.`,
  );
}

console.log("\n  2. every floored gate printed its floor\n");

ok(
  "no gate with a floor stayed silent",
  silent.length === 0,
  `${silent.join(", ")} printed no floor line and ${silent.length === 1 ? "is" : "are"} not ` +
    `listed in UNFLOORED. A floor whose block stopped executing emits nothing, which ` +
    `is exactly the drift this gate cannot otherwise see. Either the floor was removed, ` +
    `in which case name it in UNFLOORED with a reason, or it stopped running.`,
);

/* the floor */

/*
 * THIS GATE'S OWN FLOOR, on FLOOR LINES READ rather than on its assertions, which are DERIVED
 * from the lines: a run that read zero floors reports a healthy-looking "0 failures".
 */
const MINIMUM_FLOOR_LINES = 26;

/**
 * The CI branch reads fewer, gates being excluded there. Measured by running with the CI flag
 * locally, which selects the identical gate SET.
 */
const MINIMUM_FLOOR_LINES_CI = 22;

const floorLinesFloor = inCI ? MINIMUM_FLOOR_LINES_CI : MINIMUM_FLOOR_LINES;

ok(
  "this gate read enough floor lines to be measuring anything",
  unique.size >= floorLinesFloor,
  `only ${unique.size} floor line(s) read, expected at least ${floorLinesFloor}` +
    `${inCI ? " (CI branch)" : ""}. A run that reads no floors compares nothing and ` +
    `reports it as health.`,
);

console.log(
  `\n  ${unique.size} floor(s) read across ${gates.length} gate(s), ` +
    `${Object.keys(UNFLOORED).length} gate(s) recorded as unfloored\n`,
);

if (failures > 0) {
  console.log(`${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`${checks} checks, 0 failures\n`);
