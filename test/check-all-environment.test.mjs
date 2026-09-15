/**
 * THE REPLAY PROOF FOR check-all.mjs's ENVIRONMENT CLASSIFIER.
 *
 * The defect being replayed, measured 2026-09-15: all 32 offline gates exited
 * 3221225794 (0xC0000142 STATUS_DLL_INIT_FAILED) in 0.0s having written
 * nothing to either stream, and the tier reported "0 passed, 0 failed, 32
 * errored" above thirty-two separate no-verdict banners. One fact about the
 * machine, reported as thirty-two facts about the repo.
 *
 * ## BOTH DIRECTIONS, AND THE SECOND IS THE ONE THAT MATTERS
 *
 * Hard rule 12: a new gate is tested by replaying the defect it was written
 * for, and EXIT 1 IS NOT EVIDENCE, both ways. A classifier that answers "the
 * machine" to everything would pass the first half of this file and is exactly
 * the failure this repo spent 2026-09-14 closing: an unfailable condition,
 * hard rule 10's first class.
 *
 * So the second half is the load-bearing half. A gate that GENUINELY FAILED,
 * with a non-empty stderr and status 1, must come back unclassified, and the
 * suite must be able to tell the two apart rather than merely agreeing with
 * the one it was shown first.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { classifyEnvironmentFailure, ntstatusName } from "../scripts/check-all.mjs";

/** A gate that never reached main: the measured signature. */
const neverStarted = (name, status = 0xc0000142) => ({
  name,
  errored: true,
  status,
  ms: 0,
  ok: false,
});

/** A gate that RAN and failed: non-empty streams, an ordinary exit code. */
const reallyFailed = (name) => ({
  name,
  errored: false,
  status: 1,
  ms: 4200,
  ok: false,
});

/**
 * A gate that RAN, PRINTED, AND THEN CRASHED. Non-empty streams, but an
 * NTSTATUS-shaped status and a fast exit, so conditions 2, 3 and 4 all match
 * and ONLY the empty-streams guard keeps it out.
 *
 * ADDED AFTER A PLANT EXPOSED THE TEST ABOVE AS PASSING FOR THE WRONG REASON:
 * with status 1 it was excluded by the NTSTATUS condition, so removing the
 * safety condition entirely left it green. This is the case that actually
 * exercises the guard.
 */
const crashedAfterSpeaking = (name) => ({
  name,
  errored: false,
  status: 0xc0000005,
  ms: 12,
  ok: false,
});

test("the replayed defect is classified: many gates, one status, no output", () => {
  const group = classifyEnvironmentFailure([
    neverStarted("check:admin-ui"),
    neverStarted("check:backup"),
    neverStarted("check:charts"),
  ]);

  assert.notEqual(group, null, "three gates that never started must classify");
  assert.equal(group.status, 0xc0000142);
  assert.deepEqual(group.names, ["check:admin-ui", "check:backup", "check:charts"]);
});

test("A GENUINELY FAILED GATE IS NEVER THE MACHINE, which is the half that matters", () => {
  // Three real failures with ordinary exit codes.
  assert.equal(
    classifyEnvironmentFailure([
      reallyFailed("check:contrast"),
      reallyFailed("check:invariants"),
      reallyFailed("check:policy"),
    ]),
    null,
    "a classifier that calls these the machine agrees with everything",
  );

  // AND THE HARD CASE, which is what this assertion is really for. These
  // crashed with an NTSTATUS code, fast, more than one of them, so conditions
  // 2, 3 and 4 all match and the empty-streams guard is the only thing
  // standing between them and a wrong answer. The three above are excluded by
  // their exit code, which a plant proved is NOT the same test.
  assert.equal(
    classifyEnvironmentFailure([
      crashedAfterSpeaking("check:contrast"),
      crashedAfterSpeaking("check:invariants"),
      crashedAfterSpeaking("check:policy"),
    ]),
    null,
    "a gate that printed a verdict and then crashed still reported on its subject",
  );
});

test("a mixed run keeps the real failures out of the group", () => {
  const group = classifyEnvironmentFailure([
    reallyFailed("check:contrast"),
    crashedAfterSpeaking("check:policy"),
    neverStarted("check:backup"),
    neverStarted("check:charts"),
  ]);

  assert.notEqual(group, null);
  assert.deepEqual(group.names, ["check:backup", "check:charts"]);
  for (const kept of ["check:contrast", "check:policy"]) {
    assert.ok(!group.names.includes(kept), `${kept} reported a verdict and must keep it`);
  }
});

test("ONE gate is not a machine fact, however it died", () => {
  // Condition 4. This is the difference between "ambiguous" and "environment",
  // and it stays ambiguous on purpose: a single gate dying at init is exactly
  // what an errored gate already reports.
  assert.equal(classifyEnvironmentFailure([neverStarted("check:floors")]), null);
});

test("two gates with DIFFERENT statuses do not correlate", () => {
  const group = classifyEnvironmentFailure([
    neverStarted("check:backup", 0xc0000142),
    neverStarted("check:charts", 0xc0000017),
  ]);

  assert.equal(group, null, "same status is part of the conjunction, not decoration");
});

test("an ordinary nonzero exit with empty streams is still not the machine", () => {
  // Condition 2 on its own. A gate that somehow exited 1 silently is an
  // errored gate and stays one: the NTSTATUS range is what separates the OS
  // ending a process from a process choosing to stop.
  const group = classifyEnvironmentFailure([
    { name: "a", errored: true, status: 1, ms: 0, ok: false },
    { name: "b", errored: true, status: 1, ms: 0, ok: false },
  ]);

  assert.equal(group, null);
});

test("a slow gate is not the machine, however it exited", () => {
  // Condition 3. A process that never reached main cannot have taken 40s.
  const group = classifyEnvironmentFailure([
    { name: "a", errored: true, status: 0xc0000142, ms: 40_000, ok: false },
    { name: "b", errored: true, status: 0xc0000142, ms: 40_000, ok: false },
  ]);

  assert.equal(group, null);
});

test("EMPTY STREAMS DO THE SAFETY WORK: the same status on a gate that spoke", () => {
  // The conjunction's guard, isolated. Identical status, identical timing,
  // more than one gate, and the only difference is that these two said
  // something. That is the difference between a gate and a corpse.
  const group = classifyEnvironmentFailure([
    { name: "a", errored: false, status: 0xc0000142, ms: 0, ok: false },
    { name: "b", errored: false, status: 0xc0000142, ms: 0, ok: false },
  ]);

  assert.equal(group, null);
});

test("the status is rendered with its NTSTATUS name where one is known", () => {
  assert.equal(ntstatusName(0xc0000142), "0xC0000142 STATUS_DLL_INIT_FAILED");
  assert.equal(ntstatusName(0xc0000017), "0xC0000017 STATUS_NO_MEMORY");
  // Unknown codes print bare rather than being guessed at.
  assert.equal(ntstatusName(0xc0000999), "0xC0000999");
});
