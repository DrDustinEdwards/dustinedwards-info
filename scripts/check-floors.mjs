/**
 * Gate: no floor has drifted far under the count it is supposed to floor.
 *
 *   npm run check:floors
 *
 * ## Why this exists, ruling 23
 *
 * Every counting gate compares its executed count against a `MINIMUM_*` and
 * fails when the count is BELOW it. Nothing ever compared the two when the count
 * was above, so a floor set once and never re-measured sinks further under its
 * count with every assertion added. `check:policy` reached 46 under. At that
 * distance the floor is decorative: forty-six assertions could stop running and
 * it would still pass, which is the skipped-block failure the floor was put
 * there to catch, arriving through the floor itself.
 *
 * A floor that far under its count is not a safety margin. It is a floor nobody
 * has measured since the gate was half its current size.
 *
 * ## HOW IT MEASURES: it RUNS the gates
 *
 * Each counting gate prints `floor <gate>:<name> executed=<N> minimum=<M>` on a
 * passing run, from `scripts/lib/floor.mjs`. This gate runs them and reads those
 * lines back.
 *
 * Running them is the expensive option and it is the correct one. The two
 * alternatives were considered and both are worse:
 *
 *   READING THE FLOORS OUT OF SOURCE would compare a number in a file against
 *   another number in the same file. It could not see a count at all, which is
 *   half the comparison.
 *
 *   READING A LOG `check:all` LEFT BEHIND would make this gate's verdict depend
 *   on an artifact produced by the process it is checking, which is the
 *   fixture-independence rule in hard rule 10. It would also be unrunnable
 *   standalone and in CI, where no such log exists, and a gate that needs
 *   another gate to have run first is a gate that reports staleness as health.
 *
 * ## THE TOLERANCE
 *
 * `max(3, ceil(executed * 0.05))`, one constant, stated once below with its
 * reason.
 *
 * ## FAILS CLOSED ON SILENCE
 *
 * A gate that is known to carry a floor and prints NO floor line is a failure,
 * not a skip. That is the case this gate exists for in its purest form: a floor
 * whose block stopped executing emits nothing, and a reader counting only the
 * floors it CAN see would report a clean sweep of the gates that still work.
 *
 * ## OBSERVATION BOUNDARY
 *
 * It compares two numbers a gate PRINTS. It cannot tell whether the executed
 * count is itself honest: a gate whose assertions have all gone vacuous still
 * increments its counter and still reports a healthy gap. Hard rule 10 owns
 * that half, and no runner can see it.
 *
 * It also cannot see a gate with NO floor at all. Six exist and are named in
 * `UNFLOORED` below, so the absence is recorded rather than invisible.
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
 * How far under its count a floor may sit.
 *
 * ## WHY 5 PERCENT
 *
 * A floor must absorb ordinary growth without needing an edit in every commit
 * that adds an assertion, or it becomes a number people bump reflexively, which
 * is how a floor stops being read at all. Five percent of a gate's count is
 * roughly the size of one added block in the gates here, so a normal working
 * session does not trip this and a gate that has doubled since its floor was set
 * does.
 *
 * ## WHY A FLOOR OF 3 UNDER THE PERCENTAGE
 *
 * Five percent of a small count rounds to nothing. `check:hook-scope` runs 6
 * cases, and 5 percent of 6 is 1, so a pure percentage would demand its floor
 * sit within one of its count and would fail the moment a seventh case landed.
 * Three is the smallest allowance that lets a small gate grow by a case or two
 * between deliberate re-measurements.
 *
 * The two combine as a MAXIMUM rather than a minimum: whichever is more
 * generous wins, so big gates get proportional room and small gates get a flat
 * allowance.
 */
export const FLOOR_TOLERANCE = (/** @type {number} */ executed) =>
  Math.max(3, Math.ceil(executed * 0.05));

/**
 * Gates that carry NO floor, each with the reason, so an absence is argued
 * rather than accumulated. Same shape as `check-all.mjs`'s CI_EXCLUDED.
 *
 * These are NOT skipped: they are still run, and a floor line appearing in one
 * of them is a welcome surprise rather than an error. What this map buys is that
 * a reader can tell "no floor line because there is no floor" from "no floor
 * line because the floor stopped executing", which is the whole subject.
 *
 * @type {Record<string, string>}
 */
const UNFLOORED = {
  "check:types": "delegates wholly to tsc -b, which owns its own reporting.",
  "check:content": "carries two scope floors on files and assets walked.",
  /*
   * OFFLINE TIER, contrary to the obvious guess: it defaults to `--local` and
   * only `check:all` passes it `--remote`, so it IS run from here. Its four
   * floors are on TABLE COUNTS through a local `floor()` helper, which are scope
   * proofs rather than executed counts.
   */
  "check:backup": "carries four scope floors on table counts, not an executed-count floor.",
  "check:image-weight": "asserts per-row and reports rows examined; no executed-count floor.",
  /*
   * Its two floors are on BUILT CHUNKS and FILES WALKED, which are scope proofs
   * rather than executed counts. Measured 2026-09-05 the syntax floor stands at
   * 78 against 15, which reads as drift and is not: the chunk count is a
   * property of the bundler's splitting on the day, and a floor pinned near 78
   * would fail any build that emits fewer. The gate's own comment carries this.
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
   * RECURSION, and the expensive kind. `check:head` extracts a worktree and runs
   * the whole offline tier inside it. This gate is IN that tier, so running
   * check:head from here would run every counting gate inside an extraction
   * that is itself running every counting gate.
   *
   * Nothing is lost by skipping it: the floor lines that surface in check:head's
   * stdout belong to its CHILD gates, and every one of those is run directly
   * here. `check-head.mjs`'s EXCLUDED carries the matching entry in the other
   * direction.
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
 * THE OFFLINE TIER ONLY, and this is a correctness constraint rather than a
 * speed one.
 *
 * This gate is itself tiered OFFLINE, so `npm run check` runs it. If it ran
 * every discovered gate it would reach `check:media`, which CLAUDE.md records as
 * NETWORK ONLY, and the offline tier would quietly acquire a network dependency
 * through the one gate whose job is reading other gates.
 *
 * The tier map is imported from `check-all.mjs` rather than restated, so a gate
 * retiered there cannot leave a second opinion here.
 */
/*
 * AND IN CI, THE OFFLINE TIER MINUS WHAT CI CANNOT RUN.
 *
 * `check-all.mjs` records five gates a clean checkout cannot pass, each with a
 * measured reason: check:config, check:backup, check:head, check:browser,
 * check:page-payload. Running them from here in CI would fail this gate for
 * reasons that have nothing to do with any floor, and "fix the floors" would be
 * the wrong lesson to hand whoever read the red.
 *
 * Detected the way CI announces itself rather than by a flag, so nobody has to
 * remember to pass one in the workflow file.
 */
const inCI = Boolean(process.env.CI);

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const gates = gateNames(pkg).filter(
  (name) =>
    !NOT_RUN[name] && TIERS[name] === "offline" && !(inCI && CI_EXCLUDED[name]),
);

if (gates.length === 0) {
  console.log("  FAIL  no gates discovered. Every assertion below would pass by running nothing.\n");
  process.exit(1);
}

console.log(`  running ${gates.length} gate(s) for their floor lines\n`);

/** @type {{ gate: string, name: string, executed: number, minimum: number }[]} */
const floors = [];
/** @type {string[]} */
const silent = [];

for (const gate of gates) {
  const result = spawnSync(`npm run -s ${gate}`, {
    cwd: root,
    encoding: "utf8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

  /*
   * A GATE THAT FAILED IS NOT A FLOOR READING. Its floor lines, if any, came
   * from a run that had already refused, and treating them as measurements
   * would let this gate report on numbers the producing gate disowned. The
   * failure is reported here and the gate contributes nothing.
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

  if (found.length === 0 && !UNFLOORED[gate]) silent.push(gate);
  floors.push(...found);
}

/*
 * DEDUPED ON gate:name. A floor line names the gate that produced it rather
 * than being attributed to the process that printed it, so the same floor read
 * twice is one floor. Nothing here reads check:head today, but the dedupe is
 * what makes that safe if it ever does.
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

/* --------------------------------------------------------------- the floor --- */

/*
 * THIS GATE'S OWN FLOOR, and it is on FLOOR LINES READ rather than on its
 * assertions, because the assertion count is DERIVED from the lines: a run that
 * read zero floors would make zero comparisons and report a clean sweep with a
 * perfectly healthy-looking "0 failures".
 *
 * MEASURED 2026-09-05 by RUNNING this gate: 34 floor lines across 24 gates.
 */
const MINIMUM_FLOOR_LINES = 26;

/**
 * The CI branch reads fewer, because five gates are excluded there and three of
 * them carry floors. Measured by running this gate with CI=1 locally, which
 * selects the identical gate SET; the counts themselves are properties of each
 * gate rather than of the machine.
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
