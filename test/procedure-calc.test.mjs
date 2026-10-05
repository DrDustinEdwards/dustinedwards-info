import test from "node:test";
import assert from "node:assert/strict";

import { allSteps, parseProcedure, readCalcs } from "../app/lib/procedures/parse.mjs";
import { validateProcedure } from "../app/lib/procedures/validate.mjs";

/* Calculators in a procedure's steps (docs/PROCEDURES.md): a step's CALC flag names calculators from the tools
 * registry, with any values the step itself states, and validate.mjs refuses what the record cannot back. */

const PROTOCOL = `---
profile: protocol
method: [pcr]
path: /research/protocols/mini
title: Mini protocol
seo_title: Mini protocol
description: A small protocol for the tests.
version: "1"
updated: 2026-09-30
status: draft
last_run: 2026-09-01
host_strain: not applicable
biosafety: not applicable
biosafety_level: BSL-1
scale: { count: 1, unit: tube }
based_on:
  - citation: Test source
    for: the method
materials:
  - name: buffer
    amount: 10 µl
equipment:
  - microcentrifuge
troubleshooting:
  - id: low-yield
    step: "1"
    problem: Low yield.
    reason: Too little buffer.
    solution: Add more.
expected_results: A result.
limitations: A limit.
references:
  - "Test reference."
---

## Method

1. Add @buffer{10%µl} to the tube and plate 10 µl on each of 6 plates.
   > TROUBLESHOOTING: low-yield
`;

/** @param {string} flag */
const withFlag = (flag) => PROTOCOL.replace("   > TROUBLESHOOTING: low-yield", `   > TROUBLESHOOTING: low-yield\n   > CALC: ${flag}`);
/** @param {string} raw */
const parsed = (raw) => parseProcedure({ file: "mini", raw });
/** @param {string} raw */
const errorsOf = (raw) => validateProcedure(parsed(raw), { slug: "mini" }).errors.join("\n");

test("the small protocol is valid before any calculator is added", () => {
  assert.equal(errorsOf(PROTOCOL.replace("biosafety: not applicable", "biosafety: not applicable")), "");
});

test("readCalcs gives each calculator the values written after it", () => {
  assert.deepEqual(readCalcs(["titer", "dilution", "volume=10", "plates=6"]), [
    { id: "titer", values: {} },
    { id: "dilution", values: { volume: "10", plates: "6" } },
  ]);
  assert.deepEqual(readCalcs(["volume=10"]), [{ id: "", values: { volume: "10" } }]);
});

test("a CALC flag is read from a step, with commas or spaces between calculators", () => {
  assert.deepEqual(allSteps(parsed(withFlag("titer, dilution")))[0]?.flags.calc, ["titer", "dilution"]);
  assert.deepEqual(allSteps(parsed(withFlag("titer dilution")))[0]?.flags.calc, ["titer", "dilution"]);
  assert.equal(errorsOf(withFlag("titer, dilution")), "");
});

test("a calculator must exist in the registry, be named once, and belong to a protocol", () => {
  assert.match(errorsOf(withFlag("no-such-tool")), /CALC names "no-such-tool", which is not a calculator/);
  assert.match(errorsOf(withFlag("titer titer")), /CALC names a calculator twice/);
  assert.match(errorsOf(withFlag("volume=10")), /CALC gives a value before it names a calculator/);
  const recipe = withFlag("titer").replace("profile: protocol", "profile: recipe");
  assert.match(errorsOf(recipe), /CALC belongs to the protocol profile/);
});

test("a value is filled in only from the step's own words, into a field the calculator has", () => {
  assert.equal(errorsOf(withFlag("webbed-plate volume=10 plates=6")), "");
  assert.match(errorsOf(withFlag("webbed-plate volume=25")), /does not state 25; a value is filled in only from the step's own words/);
  assert.match(errorsOf(withFlag("webbed-plate colour=10")), /CALC webbed-plate has no field "colour" \(titer, pfu, volume, plates\)/);
});
