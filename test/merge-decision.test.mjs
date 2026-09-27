import test from "node:test";
import assert from "node:assert/strict";

import { VISUAL_LABEL, mergeDecision } from "../scripts/lib/merge-decision.mjs";

const HEAD = "a".repeat(40);
const PR = { number: 7, state: "OPEN", isDraft: false, baseRefName: "main", headRefOid: HEAD, labels: [] };
const GREEN = { headSha: HEAD, event: "pull_request", status: "completed", conclusion: "success" };

test("an open, non-visual PR to main with green CI on its exact head merges", () => {
  assert.deepEqual(mergeDecision(PR, [GREEN]), { merge: true });
});

/* Every refusal seen once, each on the one fact that should cause it. */
const REFUSED = [
  ["labelled visual", { ...PR, labels: ["docs", VISUAL_LABEL] }, [GREEN], /labelled "visual"/],
  ["closed", { ...PR, state: "CLOSED" }, [GREEN], /closed, not open/],
  ["a draft", { ...PR, isDraft: true }, [GREEN], /draft/],
  ["not to main", { ...PR, baseRefName: "feat/x" }, [GREEN], /targets feat\/x/],
  ["no CI run at all", PR, [], /no CI run exists/],
  ["green only on an earlier head", PR, [{ ...GREEN, headSha: "b".repeat(40) }], /no CI run exists/],
  ["green only on the push event", PR, [{ ...GREEN, event: "push" }], /no CI run exists/],
  ["CI still running", PR, [{ ...GREEN, status: "in_progress", conclusion: null }], /still running/],
  ["CI failed", PR, [{ ...GREEN, conclusion: "failure" }], /concluded failure/],
  ["one green run and one failed rerun", PR, [GREEN, { ...GREEN, conclusion: "cancelled" }], /concluded cancelled/],
];

for (const [label, pr, runs, reason] of REFUSED) {
  test(`refused: ${label}`, () => {
    const decision = mergeDecision(/** @type {typeof PR} */ (pr), /** @type {(typeof GREEN)[]} */ (runs));
    assert.equal(decision.merge, false);
    assert.match("reason" in decision ? decision.reason : "", /** @type {RegExp} */ (reason));
  });
}
