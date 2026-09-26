/**
 * Ship records the uptime step as skipped only when uptime-ensure reports a keyless GitHub-runner run
 * by both its dedicated exit code and its dedicated line. Every other outcome that is not a counted
 * success is a miss, including a missing key on the operator machine, so a failure can never pass
 * for a skip.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  KEY_ABSENT_EXIT,
  KEY_ABSENT_LINE,
  UPTIME_SKIP_NOTE,
  keylessRunIsExpected,
  uptimeStepOutcome,
} from "../scripts/lib/uptime-step.mjs";

test("a keyless GitHub-runner run, by its code and its line, is a skip carrying the note", () => {
  assert.deepEqual(uptimeStepOutcome(KEY_ABSENT_EXIT, `\nuptime-ensure\n\n${KEY_ABSENT_LINE}\n`), {
    state: "skipped",
    note: UPTIME_SKIP_NOTE,
  });
});

test("the skip note names the real cause, what was not done and when it will be", () => {
  assert.match(UPTIME_SKIP_NOTE, /GitHub runner/);
  assert.match(UPTIME_SKIP_NOTE, /NOT touched/);
  assert.match(UPTIME_SKIP_NOTE, /domain move/);
});

test("a keyless run is expected only on a GitHub runner", () => {
  assert.equal(keylessRunIsExpected({ GITHUB_ACTIONS: "true" }), true);
});

test("a keyless run on any other machine is a lost credential, not a skip", () => {
  assert.equal(keylessRunIsExpected({}), false);
  assert.equal(keylessRunIsExpected({ GITHUB_ACTIONS: "false" }), false);
  assert.equal(keylessRunIsExpected({ GITHUB_ACTIONS: "" }), false);
  assert.equal(keylessRunIsExpected({ CI: "true" }), false);
});

test("the local missing-key failure, exit 1, is a miss", () => {
  assert.equal(
    uptimeStepOutcome(1, "UPTIMEROBOT_API_KEY is missing or empty in .dev.vars").state,
    "missed",
  );
});

test("the absent-key line under any other exit code is a miss", () => {
  assert.equal(uptimeStepOutcome(1, KEY_ABSENT_LINE).state, "missed");
  assert.equal(uptimeStepOutcome(0, KEY_ABSENT_LINE).state, "missed");
});

test("the absent-key code without its line is a miss", () => {
  assert.equal(uptimeStepOutcome(KEY_ABSENT_EXIT, "GET /alert-contacts answered 401").state, "missed");
});

test("any other failure is a miss", () => {
  assert.equal(uptimeStepOutcome(1, "create home answered 500").state, "missed");
});

test("exit 0 without a change count is a miss", () => {
  assert.equal(uptimeStepOutcome(0, "manifest: scripts/uptime-monitors.json").state, "missed");
});

test("exit 0 with a change count is applied, with the count read off the output", () => {
  assert.deepEqual(uptimeStepOutcome(0, "  2 change(s) applied.\n"), { state: "applied", changes: 2 });
});
