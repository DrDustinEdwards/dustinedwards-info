/**
 * Telling a RED gate from a CRASHED gate tier, in front of the deploy.
 *
 * REPLAYS THE DEFECT, per the replay rule. On 2026-09-21 at ffd85ee, ship refused at the gate step
 * with "a gate is red. Read the table above for the failing gate NAME before retrying" and
 * printed no table and no gate name; the same tier run standalone passed 35 of 35. The tier had
 * been killed under memory pressure, and `run()` collapsed a null status to exit 1, so ship had
 * nothing left that said "killed" and worded the refusal as a gate verdict.
 *
 * THE TWO PLANTS THE FIX WAS WRITTEN FOR ARE THE FIRST TWO CASES, and they are the pair that has
 * to be told apart: a gate that ran and failed, and a tier killed mid-run. Both refuse. Only the
 * wording differs, and the wording is the defect.
 *
 * The rest are the directions a naive implementation gets wrong: a zero exit with no table is not
 * a pass, and an NTSTATUS exit code is not a gate's chosen exit code.
 *
 * @see scripts/lib/tier-outcome.mjs
 * @see scripts/ship.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import { tierOutcome } from "../scripts/lib/tier-outcome.mjs";

/** What the tier prints when it finishes, red. Trimmed from a real run of 2026-09-21. */
const RED_TABLE = `
----------------------------------------------------
  PASS  check:admin-ui       20.8s   730MB
  FAIL  check:backup         13.8s   849MB
  PASS  check:charts         30.3s   799MB
  FAIL  check:config          4.3s   268MB
  SKIP  check:browser      needs the network, run: npm run check:all
----------------------------------------------------

31 passed, 4 failed, 9 skipped, peak 2043MB at check:worker
`;

/** The same run, green. */
const GREEN_TABLE = `
----------------------------------------------------
  PASS  check:admin-ui       20.8s   730MB
  PASS  check:charts         30.3s   799MB
----------------------------------------------------

35 passed, 0 failed, 9 skipped, peak 7908MB at check:worker
`;

/** A tier killed partway: rows for the gates that finished, and no summary line. */
const KILLED_PARTWAY = `
check running 35 of 44 gate(s) (offline tier)

  check:admin-ui ... ok (17.5s 721MB)
  check:backup ... ok (12.1s 802MB)
  check:charts ...
`;

test("PLANT 1: a gate that ran and failed is named, and is not called a crash", () => {
  const o = tierOutcome({ code: 1, signal: null, text: RED_TABLE });

  assert.equal(o.state, "red");
  assert.deepEqual(o.failing, ["check:backup", "check:config"]);
  assert.match(o.why, /check:backup/);
  assert.match(o.why, /check:config/);
  // The remedy must point at the gates, not at a crash.
  assert.match(o.remedy, /gate verdict rather than a crash/);
});

test("PLANT 2: a tier killed mid-run says it crashed, and names no gate", () => {
  const o = tierOutcome({ code: null, signal: "SIGKILL", text: KILLED_PARTWAY });

  assert.equal(o.state, "crashed");
  assert.deepEqual(o.failing, []);
  assert.match(o.why, /crashed/);
  assert.match(o.why, /no gate result exists/);
  // The defect in one assertion: the old message claimed a gate was red.
  assert.doesNotMatch(o.why, /a gate is red/);
  assert.match(o.why, /signal SIGKILL/);
});

test("both refuse: only the wording differs, never the direction", () => {
  const red = tierOutcome({ code: 1, signal: null, text: RED_TABLE });
  const crashed = tierOutcome({ code: null, signal: "SIGKILL", text: KILLED_PARTWAY });

  for (const o of [red, crashed]) assert.notEqual(o.state, "passed");
  assert.notEqual(red.why, crashed.why);
});

test("a tier that reported everything passing passes", () => {
  const o = tierOutcome({ code: 0, signal: null, text: GREEN_TABLE });

  assert.equal(o.state, "passed");
  assert.deepEqual(o.failing, []);
  assert.match(o.why, /35 passed, 0 failed/);
});

test("a zero exit with no summary line is a crash, not a pass", () => {
  // A runner killed between its last gate and its table can exit zero. "It did not say it
  // passed" and "it passed" are different facts.
  const o = tierOutcome({ code: 0, signal: null, text: KILLED_PARTWAY });

  assert.equal(o.state, "crashed");
  assert.match(o.why, /produced no result table/);
});

test("STATUS_DLL_INIT_FAILED is a crash and is named, not read as a gate's exit code", () => {
  const o = tierOutcome({ code: 3221225794, signal: null, text: KILLED_PARTWAY });

  assert.equal(o.state, "crashed");
  assert.match(o.why, /STATUS_DLL_INIT_FAILED/);
});

test("an out-of-memory NTSTATUS is a crash", () => {
  const o = tierOutcome({ code: 3221225495, signal: null, text: KILLED_PARTWAY });

  assert.equal(o.state, "crashed");
  assert.match(o.why, /STATUS_NO_MEMORY/);
});

test("a signal wins over a summary: a tier killed AFTER printing still crashed", () => {
  // The table is present and says nothing failed, and the process was killed anyway. Reading
  // the table alone would report a pass on a run that did not survive.
  const o = tierOutcome({ code: null, signal: "SIGTERM", text: GREEN_TABLE });

  assert.equal(o.state, "crashed");
});

test("an empty capture is a crash rather than a silent pass", () => {
  const o = tierOutcome({ code: 1, signal: null, text: "" });

  assert.equal(o.state, "crashed");
  assert.deepEqual(o.failing, []);
});

test("a red table with a nonzero exit but no FAIL rows still refuses and counts", () => {
  // The rows and the summary are two readings of the same run. If the rows cannot be parsed,
  // the count must still refuse rather than fall through to a pass.
  const text = "\n12 passed, 3 failed, 0 skipped\n";
  const o = tierOutcome({ code: 1, signal: null, text });

  assert.equal(o.state, "red");
  assert.deepEqual(o.failing, []);
  assert.match(o.why, /3 failed/);
});
