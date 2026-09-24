/**
 * The CI-must-be-green check that stands in front of the deploy.
 *
 * REPLAYS THE FINDING, per the replay rule. The 2026-08-22 audit, section 8: "CI
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
import { createServer } from "node:http";

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
  assert.equal(v.state, "no-run");
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
  assert.equal(v.state, "failed");
  assert.ok(v.remedy.includes("failure"), "the refusal names the conclusion");
});

test("canceled and timed_out are not failures and are not passes either", () => {
  for (const conclusion of ["cancelled", "timed_out", "action_required", "skipped", "neutral"]) {
    const v = ciVerdict({ workflow_runs: [{ ...green, conclusion }] }, SHA);
    assert.equal(v.ok, false, `${conclusion} must not deploy`);
    assert.equal(v.state, "failed");
    assert.ok(v.remedy.includes(conclusion), `the refusal names ${conclusion}`);
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
  assert.equal(v.state, "running");
});

/*
 * THE STATE FIELD IS AN INTERFACE, so it is asserted rather than left to whoever reads `why`.
 * Ship waits on exactly one of the four refusals, a run in flight, and treats the other three as
 * reasons to stop waiting. Telling them apart by matching the prose above would make every
 * sentence in ci-status.mjs load-bearing, and the wording is not the contract.
 */
test("every verdict carries the state that names it, refusals included", () => {
  const cases = [
    [{ workflow_runs: [green] }, "green", true],
    [{ workflow_runs: [{ ...green, status: "in_progress", conclusion: null }] }, "running", false],
    [{ workflow_runs: [{ ...green, conclusion: "failure" }] }, "failed", false],
    [{ workflow_runs: [] }, "no-run", false],
    [{ workflow_runs: "nope" }, "unparseable", false],
  ];

  for (const [payload, state, ok] of cases) {
    const v = ciVerdict(payload, SHA);
    assert.equal(v.state, state, `this payload must report state ${state}`);
    assert.equal(v.ok, ok, `state ${state} must ${ok ? "" : "not "}deploy`);
  }

  // The five states are distinct. One constant returned everywhere would satisfy each
  // assertion above taken on its own.
  const states = cases.map(([payload]) => ciVerdict(payload, SHA).state);
  assert.equal(new Set(states).size, cases.length);
});

test("only a run in flight is the waitable refusal", () => {
  // Ship polls on `running` and stops on the rest. A second refusal reading as `running` would
  // make ship wait out its whole timeout on a commit that had already failed.
  const failed = ciVerdict({ workflow_runs: [{ ...green, conclusion: "failure" }] }, SHA);
  const none = ciVerdict({ workflow_runs: [] }, SHA);

  for (const v of [failed, none]) assert.notEqual(v.state, "running");
});

test("one green run does not excuse a second failing one", () => {
  const v = ciVerdict(
    { workflow_runs: [green, { ...green, name: "Other", conclusion: "failure" }] },
    SHA,
  );
  assert.equal(v.ok, false);
  assert.ok(v.remedy.includes("Other"), "the refusal names the failing workflow");
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
  /*
   * A 404 must throw rather than read as an empty run list, which is the
   * dangerous reading: no runs for this sha and a refused request look
   * identical to a caller that only counts.
   *
   * ## THIS ASKED GITHUB UNTIL 2026-08-24, AND THAT WAS THE DEFECT
   *
   * It called the real API with a nonsense repo path and asserted `4\d\d`,
   * relying on GitHub to answer 404. On 2026-08-24 GitHub answered **504** for
   * that path, repeatably, and the assertion failed: the code under test was
   * behaving perfectly, throwing with the status it received, and the only
   * broken thing was the test's assumption about a third party.
   *
   * Two separate faults, and the second is the one worth naming. It was FLAKY,
   * and it was in the OFFLINE TIER, whose stated contract is "safe on a plane".
   * A behavioral test that needs the public internet to pass is not offline,
   * and this is the one gate in the suite that asserts behavior, so its
   * flakiness lands on `ship`, which runs that tier before every deploy. A
   * transient at the wrong moment refuses a deploy for a reason that has
   * nothing to do with the deploy.
   *
   * `apiBase` was always the seam. The status is now chosen by a local server,
   * so the test asserts what it always meant to assert and nothing else.
   */
  const server = createServer((_request, response) => {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ message: "Not Found" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    await assert.rejects(
      () =>
        fetchCiRuns({
          owner: "x",
          repo: "this-repo-does-not-exist-91a7f",
          sha: SHA,
          apiBase: `http://127.0.0.1:${port}`,
        }),
      /GitHub API answered 404/,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("a 5xx is thrown with ITS status, not flattened into the 404 hint", async () => {
  /*
   * The paired negative, and the case that exposed the flake above. A gateway
   * error must be reported as what it is: the 404 branch carries a private-repo
   * hint that would be actively misleading here, sending a reader to run
   * `gh auth login` over an upstream outage.
   */
  const server = createServer((_request, response) => {
    response.writeHead(504, { "content-type": "text/plain" });
    response.end("gateway timeout");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    await assert.rejects(
      () => fetchCiRuns({ owner: "x", repo: "y", sha: SHA, apiBase: `http://127.0.0.1:${port}` }),
      (error) => {
        assert.match(error.message, /GitHub API answered 504/);
        assert.doesNotMatch(error.message, /gh auth login/);
        return true;
      },
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
