import test from "node:test";
import assert from "node:assert/strict";

import { tierOutcome } from "../scripts/lib/tier-outcome.mjs";

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

const GREEN_TABLE = `
----------------------------------------------------
  PASS  check:admin-ui       20.8s   730MB
  PASS  check:charts         30.3s   799MB
----------------------------------------------------

35 passed, 0 failed, 9 skipped, peak 7908MB at check:worker
`;

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
  assert.match(o.remedy, /gate verdict rather than a crash/);
});

test("PLANT 2: a tier killed mid-run says it crashed, and names no gate", () => {
  const o = tierOutcome({ code: null, signal: "SIGKILL", text: KILLED_PARTWAY });

  assert.equal(o.state, "crashed");
  assert.deepEqual(o.failing, []);
  assert.match(o.why, /crashed/);
  assert.match(o.why, /no gate result exists/);
  assert.doesNotMatch(o.why, /a gate is red/);
  assert.match(o.why, /signal SIGKILL/);
});

test("a tier that reported everything passing passes", () => {
  const o = tierOutcome({ code: 0, signal: null, text: GREEN_TABLE });

  assert.equal(o.state, "passed");
  assert.deepEqual(o.failing, []);
  assert.match(o.why, /35 passed, 0 failed/);
});

test("a zero exit with no summary line is a crash, not a pass", () => {
  // A runner killed between its last gate and its table can exit zero.
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
  const o = tierOutcome({ code: null, signal: "SIGTERM", text: GREEN_TABLE });

  assert.equal(o.state, "crashed");
});

test("an empty capture is a crash rather than a silent pass", () => {
  const o = tierOutcome({ code: 1, signal: null, text: "" });

  assert.equal(o.state, "crashed");
  assert.deepEqual(o.failing, []);
});

test("a red table with a nonzero exit but no FAIL rows still refuses and counts", () => {
  const text = "\n12 passed, 3 failed, 0 skipped\n";
  const o = tierOutcome({ code: 1, signal: null, text });

  assert.equal(o.state, "red");
  assert.deepEqual(o.failing, []);
  assert.match(o.why, /3 failed/);
});

test("a zero exit over a nonzero failed count is red, not passed", () => {
  const text = `\n${"-".repeat(52)}\n  PASS  check:content 1.0s\n${"-".repeat(52)}\n\n34 passed, 1 failed\n`;
  const o = tierOutcome({ code: 0, signal: null, text });

  assert.equal(o.state, "red");
  assert.match(o.why, /1 failed/);
});

test("0 passed, 0 failed is not a pass: a tier that ran nothing asserted nothing", () => {
  const o = tierOutcome({ code: 0, signal: null, text: "\n0 passed, 0 failed\n" });

  assert.notEqual(o.state, "passed");
  assert.match(o.why, /ran no gate/);
});

test("the LAST summary line is the tier's: a failed gate's own summary above the table is not read", () => {
  // check-all prints each failed gate's output ABOVE the table, and a gate can print its own tally.
  const text =
    "\ncheck:tests\n  3 passed, 0 failed\n" +
    `\n${"-".repeat(52)}\n  FAIL  check:tests 9.0s\n${"-".repeat(52)}\n\n20 passed, 1 failed\n`;
  const o = tierOutcome({ code: 1, signal: null, text });

  assert.equal(o.state, "red");
  assert.deepEqual(o.failing, ["check:tests"]);
  assert.match(o.why, /20 passed, 1 failed/);
});

test("FAIL lines in a gate's own output are not named as failing gates", () => {
  const text =
    "\ncheck:content\n  FAIL  every post has a date\n" +
    `\n${"-".repeat(52)}\n  FAIL  check:content 2.0s\n  PASS  check:urls 1.0s\n${"-".repeat(52)}\n\n1 passed, 1 failed\n`;
  const o = tierOutcome({ code: 1, signal: null, text });

  assert.deepEqual(o.failing, ["check:content"]);
});

test("errored gates with nothing failed are no verdict, never a pass", () => {
  const o = tierOutcome({ code: 1, signal: null, text: "\n30 passed, 0 failed, 2 errored\n" });

  assert.equal(o.state, "crashed");
  assert.match(o.why, /2 gate\(s\) errored/);
});

test("a zero exit with an errored count still does not pass", () => {
  const o = tierOutcome({ code: 0, signal: null, text: "\n30 passed, 0 failed, 1 errored\n" });

  assert.notEqual(o.state, "passed");
});

test("the heap-corruption NTSTATUS is a crash, the same table check-all names", () => {
  const o = tierOutcome({ code: 0xc0000374, signal: null, text: GREEN_TABLE });

  assert.equal(o.state, "crashed");
  assert.match(o.why, /STATUS_HEAP_CORRUPTION/);
});
