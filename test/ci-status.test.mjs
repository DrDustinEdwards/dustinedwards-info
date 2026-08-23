/**
 * The CI-must-be-green check that stands in front of the deploy.
 *
 * REPLAYS THE FINDING, per hard rule 12. The 2026-08-22 audit, section 8: "CI
 * runs on push to main, after the fact. Nothing prevents a push that fails CI
 * from being deployed, because deploy is manual and local. The gate tier runs in
 * `ship`, so in practice the same checks run, but CI is advisory only."
 * Verified TRUE against the code on 2026-08-23: nothing in ship consulted CI.
 *
 * Each case below is a state that a naive check reads as success. The
 * no-run case is the one that matters most: an empty array satisfies `every()`,
 * so the obvious implementation deploys an unpushed commit while reporting that
 * CI passed.
 *
 * @see scripts/lib/ci-status.mjs
 * @see scripts/ship.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import { ciVerdict, fetchCiRuns } from "../scripts/lib/ci-status.mjs";

const SHA = "e15b883";

/** A completed, successful push run, as GitHub reports it. */
const green = {
  name: "CI",
  event: "push",
  status: "completed",
  conclusion: "success",
  html_url: "https://github.com/x/y/actions/runs/1",
};

test("a green push run may deploy", () => {
  const v = ciVerdict({ workflow_runs: [green] }, SHA);
  assert.equal(v.ok, true);
  assert.match(v.why, /CI: success/);
});

test("PLANT 1: a sha with no run refuses, and does not read as nothing-failed", () => {
  // The empty-array trap: `[].every(r => r.conclusion === "success")` is TRUE,
  // so the obvious implementation deploys an unpushed commit.
  const v = ciVerdict({ workflow_runs: [] }, SHA);
  assert.equal(v.ok, false);
  assert.match(v.why, /no CI run exists for e15b883/);
  assert.match(v.remedy, /not pushed/);
  assert.match(v.remedy, /Nothing was deployed/);
});

test("a sha whose only runs are scheduled still counts as no run", () => {
  // The health workflow runs on a schedule and must never be mistaken for CI.
  const scheduled = { ...green, name: "Health", event: "schedule" };
  const v = ciVerdict({ workflow_runs: [scheduled] }, SHA);
  assert.equal(v.ok, false);
  assert.match(v.why, /no CI run exists/);
});

test("PLANT 2: a fabricated failure conclusion refuses and names it", () => {
  const v = ciVerdict({ workflow_runs: [{ ...green, conclusion: "failure" }] }, SHA);
  assert.equal(v.ok, false);
  assert.match(v.why, /CI did not pass for e15b883/);
  assert.match(v.remedy, /CI concluded failure/);
  assert.match(v.remedy, /no override/);
});

test("cancelled and timed_out are not failures and are not passes either", () => {
  for (const conclusion of ["cancelled", "timed_out", "action_required", "skipped", "neutral"]) {
    const v = ciVerdict({ workflow_runs: [{ ...green, conclusion }] }, SHA);
    assert.equal(v.ok, false, `${conclusion} must not deploy`);
    assert.match(v.remedy, new RegExp(`concluded ${conclusion}`));
  }
});

test("a run still in progress refuses: green so far is not green", () => {
  // `conclusion` is null while in flight, and null !== "failure" reads as fine.
  const v = ciVerdict(
    { workflow_runs: [{ ...green, status: "in_progress", conclusion: null }] },
    SHA,
  );
  assert.equal(v.ok, false);
  assert.match(v.why, /still running/);
  assert.match(v.remedy, /green so far is not a green run/);
});

test("one green run does not excuse a second failing one", () => {
  const v = ciVerdict(
    { workflow_runs: [green, { ...green, name: "Other", conclusion: "failure" }] },
    SHA,
  );
  assert.equal(v.ok, false);
  assert.match(v.remedy, /Other concluded failure/);
});

test("an unparseable payload refuses rather than reading as empty", () => {
  for (const payload of [{}, null, undefined, { workflow_runs: "nope" }, []]) {
    const v = ciVerdict(payload, SHA);
    assert.equal(v.ok, false, `${JSON.stringify(payload)} must not deploy`);
    assert.match(v.why, /no workflow_runs array/);
  }
});

test("PLANT 3: an unreachable API throws rather than returning a pass", async () => {
  // A host that cannot resolve. The caller in ship.mjs turns this into a
  // refusal; what matters here is that it does NOT resolve to a value that
  // ciVerdict could read as success.
  await assert.rejects(
    () =>
      fetchCiRuns({
        owner: "x",
        repo: "y",
        sha: SHA,
        apiBase: "https://api.github.invalid-host-that-does-not-resolve",
      }),
    (error) => {
      assert.ok(error instanceof Error, "must throw an Error the caller can name");
      return true;
    },
  );
});

test("a non-2xx API answer throws with its status", async () => {
  // 404 from a real host: the repo path is nonsense, so GitHub answers 404
  // rather than an empty run list. An empty list would have been the dangerous
  // reading, and this proves the code never gets one.
  await assert.rejects(
    () => fetchCiRuns({ owner: "x", repo: "this-repo-does-not-exist-91a7f", sha: SHA }),
    /GitHub API answered 4\d\d/,
  );
});
