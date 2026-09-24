/**
 * The repo is the source of truth and D1 a derived index, so a failed D1 write is recorded, never
 * compensated by reverting the commit.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { DIVERGENCE_ERROR_NAME, convergeWithRetry } from "../app/lib/editor/converge.mjs";

const SLUG = "agent-write-access-to-a-live-site";
const SHA = "a1b2c3d";

function writerFailing(failures) {
  const state = { calls: 0 };
  return {
    state,
    write: async () => {
      state.calls += 1;
      if (state.calls <= failures) throw new Error(`D1_TIMEOUT_${state.calls}`);
      return "written";
    },
  };
}

function recorder() {
  const state = { recorded: [] };
  return { state, recordDivergence: async (facts) => void state.recorded.push(facts) };
}

test("the happy path writes once and records nothing", async () => {
  const w = writerFailing(0);
  const r = recorder();
  const result = await convergeWithRetry({ ...w, ...r, slug: SLUG, commitSha: SHA });

  assert.deepEqual(result, { ok: true, attempts: 1, retried: false });
  assert.equal(w.state.calls, 1, "no retry when the first attempt succeeded");
  assert.deepEqual(r.state.recorded, [], "nothing diverged, so nothing is recorded");
});

test("FAILURE POINT 1: D1 fails once, the retry converges, NO drift is recorded", async () => {
  const w = writerFailing(1);
  const r = recorder();
  const result = await convergeWithRetry({ ...w, ...r, slug: SLUG, commitSha: SHA });

  assert.equal(result.ok, true);
  assert.equal(result.retried, true, "the caller must be able to see a retry happened");
  assert.equal(w.state.calls, 2, "exactly one retry, not a loop");
  assert.deepEqual(
    r.state.recorded,
    [],
    "a transient failure that recovered is NOT a divergence; recording it would " +
      "leave a permanent alarm for a non-event",
  );
});

test("FAILURE POINT 2: D1 fails twice, the drift IS recorded and the error names the post", async () => {
  const w = writerFailing(2);
  const r = recorder();

  await assert.rejects(
    () => convergeWithRetry({ ...w, ...r, slug: SLUG, commitSha: SHA }),
    (error) => {
      assert.equal(error.name, DIVERGENCE_ERROR_NAME, "must be distinguishable by name");
      assert.match(error.message, new RegExp(SLUG), "the error must NAME THE POST");
      assert.match(error.message, new RegExp(SHA), "and the commit that landed");
      assert.match(error.message, /sync:content|Sync Ask corpus/, "and the repair path");
      assert.match(error.message, /Do NOT save again/, "and that retrying does not help");
      assert.equal(error.cause?.message, "D1_TIMEOUT_2", "the original fault is preserved");
      return true;
    },
  );

  assert.equal(w.state.calls, 2, "it stops after the retry rather than hammering D1");
  assert.equal(r.state.recorded.length, 1, "exactly one divergence recorded");
  assert.deepEqual(
    { slug: r.state.recorded[0].slug, commitSha: r.state.recorded[0].commitSha },
    { slug: SLUG, commitSha: SHA },
    "the record carries the post and the commit, not just a message",
  );
});

test("a recorder that throws does not swallow the divergence error", async () => {
  // Replacing the operator's explanation with the recorder's own failure is worse than losing the entry.
  const w = writerFailing(2);
  await assert.rejects(
    () =>
      convergeWithRetry({
        write: w.write,
        recordDivergence: async () => {
          throw new Error("KV is also down");
        },
        slug: SLUG,
        commitSha: SHA,
      }),
    (error) => {
      assert.equal(error.name, DIVERGENCE_ERROR_NAME);
      assert.match(error.message, new RegExp(SLUG));
      assert.doesNotMatch(error.message, /KV is also down/, "the recorder's fault must not replace it");
      return true;
    },
  );
});

test("attempts is honored, so the retry count is not hardcoded in the loop", async () => {
  const w = writerFailing(2);
  const r = recorder();
  const result = await convergeWithRetry({ ...w, ...r, slug: SLUG, commitSha: SHA, attempts: 3 });
  assert.equal(result.attempts, 3);
  assert.equal(w.state.calls, 3);
  assert.deepEqual(r.state.recorded, []);
});
