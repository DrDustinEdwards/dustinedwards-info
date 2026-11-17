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

await test("a keyless GitHub-runner run, by its code and its line, is a skip carrying the note", () => {
  assert.deepEqual(uptimeStepOutcome(KEY_ABSENT_EXIT, `\nuptime-ensure\n\n${KEY_ABSENT_LINE}\n`), {
    state: "skipped",
    note: UPTIME_SKIP_NOTE,
  });
});

await test("a keyless run on any other machine is a lost credential, not a skip", () => {
  assert.equal(keylessRunIsExpected({}), false);
  assert.equal(keylessRunIsExpected({ GITHUB_ACTIONS: "false" }), false);
  assert.equal(keylessRunIsExpected({ GITHUB_ACTIONS: "" }), false);
  assert.equal(keylessRunIsExpected({ CI: "true" }), false);
});

await test("the absent-key line under any other exit code is a miss", () => {
  assert.equal(uptimeStepOutcome(1, KEY_ABSENT_LINE).state, "missed");
  assert.equal(uptimeStepOutcome(0, KEY_ABSENT_LINE).state, "missed");
});
