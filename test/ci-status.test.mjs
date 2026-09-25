import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

import { ciVerdict, fetchCiRuns } from "../scripts/lib/ci-status.mjs";

const SHA = "e15b883";
const FULL_SHA = `${SHA}0123456789abcdef0123456789abcdef0`;

const green = {
  name: "CI",
  path: ".github/workflows/ci.yml",
  head_sha: FULL_SHA,
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

/* The state field is the interface: ship waits only on `running` and stops on the rest.
 * Matching the `why` prose instead would make its wording load-bearing. */
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

  // One constant returned everywhere would satisfy each assertion above taken on its own.
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
  // What matters is that a network failure does NOT resolve to a value ciVerdict could read as success.
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
  /* A 404 must throw rather than read as an empty run list. The status comes from a local
   * server, so this offline-tier test never depends on GitHub answering. */
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
  /* The 404 branch carries a private-repo hint that would send a reader to `gh auth login`
   * over an upstream outage. */
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

test("a run for another commit refuses: the head_sha filter was not applied", () => {
  const other = { ...green, head_sha: "0000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" };
  for (const runs of [[other], [green, other]]) {
    const v = ciVerdict({ workflow_runs: runs }, SHA);
    assert.equal(v.ok, false);
    assert.equal(v.state, "unparseable");
    assert.match(v.why, /not for e15b883/);
  }
});

test("a run with no head_sha refuses rather than being trusted", () => {
  const { head_sha: _dropped, ...bare } = green;
  const v = ciVerdict({ workflow_runs: [bare] }, SHA);
  assert.equal(v.ok, false);
  assert.equal(v.state, "unparseable");
});

test("a full sha matches, and an empty or short sha refuses instead of matching everything", () => {
  assert.equal(ciVerdict({ workflow_runs: [green] }, FULL_SHA).ok, true);
  for (const sha of ["", "e15b", "not-a-sha"]) {
    const v = ciVerdict({ workflow_runs: [green] }, sha);
    assert.equal(v.ok, false, `${JSON.stringify(sha)} must not deploy`);
    assert.equal(v.state, "unparseable");
  }
});

test("a green push run from another workflow is not CI", () => {
  const other = { ...green, name: "Other", path: ".github/workflows/other.yml" };
  const v = ciVerdict({ workflow_runs: [other] }, SHA);
  assert.equal(v.ok, false);
  assert.equal(v.state, "no-run");
});

test("a page holding fewer runs than the total refuses", () => {
  const v = ciVerdict({ total_count: 101, workflow_runs: [green] }, SHA);
  assert.equal(v.ok, false);
  assert.equal(v.state, "unparseable");
  assert.match(v.why, /1 of 101/);
});
