/**
 * check:protocols fails on a gap nobody has put on record, and only lists the ones that are.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { MISSING, REQUIRED_FIELDS, compareKnownMissing, inspectProtocol } from "../scripts/lib/protocols.mjs";

/** A record with every field present and no gaps. */
function complete() {
  return {
    steps: ["#pcr-conditions"],
    reagents: [{ name: "water", amount: "5.5 µL" }],
    timings: [{ stage: "anneal", temperature_c: 58, time: "60 sec." }],
    primers: [{ direction: "forward", sequence: "ACGT" }],
    equipment: ["gel"],
    host_strain: "not applicable",
    source: [{ citation: "A paper" }],
    biosafety: "E. coli K-12",
    status: "draft",
    version: "1",
    last_run: "2026-01-01",
  };
}

test("a complete record has no gaps and no errors", () => {
  assert.deepEqual(inspectProtocol(complete(), { anchors: new Set(["pcr-conditions"]) }), { missing: [], errors: [] });
});

test("REPLAY: a field removed from a record is reported missing, by name", () => {
  const record = complete();
  delete record.version;
  assert.deepEqual(inspectProtocol(record).missing, ["version"]);
});

test("no record at all is every field missing", () => {
  assert.deepEqual(inspectProtocol(undefined).missing, REQUIRED_FIELDS);
});

test("MISSING markers are reported at their path, labelled by name where the item has one", () => {
  const record = complete();
  record.reagents = [{ method: "Method 2", name: "proteinase K", amount: "1 µl", stock: MISSING }];
  assert.deepEqual(inspectProtocol(record).missing, ["reagents[Method 2 / proteinase K].stock"]);
});

test("a touchdown with no step size and an rpm spin with no g are gaps", () => {
  const record = complete();
  record.timings = [
    { stage: "15 cycles", steps: [{ temperature_c: "60 to 50", time: "45 sec." }] },
    { step: "spin", spin: "10,000 rpm", time: "1 minute" },
    { step: "spin in g", spin: "12,000 x g", time: "1 minute" },
  ];
  assert.deepEqual(inspectProtocol(record).missing, [
    "timings[15 cycles].steps[0].touchdown_step_c",
    "timings[spin].g",
  ]);
});

test("a unit outside the closed list, a bad primer and a dangling step are errors", () => {
  const record = complete();
  record.reagents = [{ name: "water", amount: "5 drops" }];
  record.primers = [{ direction: "forward", sequence: "acgt" }];
  const { errors } = inspectProtocol(record, { anchors: new Set() });
  assert.equal(errors.length, 3, errors.join("\n"));
});

test("only primers and host_strain may be not applicable", () => {
  const record = complete();
  record.status = "not applicable";
  assert.equal(inspectProtocol(record).errors.length, 1);
});

test("an unrecorded gap fails, a recorded one is listed, a filled one is stale", () => {
  const found = new Map([["/p", ["version", "status"]]]);
  const known = [
    { protocol: "/p", field: "version", reason: "waiting" },
    { protocol: "/p", field: "last_run", reason: "waiting" },
  ];
  const result = compareKnownMissing(found, known);
  assert.deepEqual(result.unrecorded, ["/p status"]);
  assert.deepEqual(result.stale, ["/p last_run"]);
  assert.deepEqual(result.recorded.map((e) => e.field), ["version"]);
  assert.deepEqual(result.malformed, []);
});

test("a known-missing entry needs a reason", () => {
  const { malformed } = compareKnownMissing(new Map(), [{ protocol: "/p", field: "version", reason: "" }]);
  assert.equal(malformed.length, 1);
});
