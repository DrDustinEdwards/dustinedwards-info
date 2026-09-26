/**
 * Ship records the uptime step as skipped only when uptime-ensure reports an absent key by both its
 * dedicated exit code and its dedicated line. Every other outcome that is not a counted success is a
 * miss, so a failure can never pass for a skip.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  KEY_ABSENT_EXIT,
  KEY_ABSENT_LINE,
  UPTIME_SKIP_NOTE,
  uptimeStepOutcome,
} from "../scripts/lib/uptime-step.mjs";

test("an absent key, by its code and its line, is a skip carrying the note", () => {
  assert.deepEqual(uptimeStepOutcome(KEY_ABSENT_EXIT, `\nuptime-ensure\n\n${KEY_ABSENT_LINE}\n`), {
    state: "skipped",
    note: UPTIME_SKIP_NOTE,
  });
});

test("the skip note says what was not done and when it will be", () => {
  assert.match(UPTIME_SKIP_NOTE, /NOT touched/);
  assert.match(UPTIME_SKIP_NOTE, /domain move/);
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
