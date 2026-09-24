/**
 * The paper twins' upload: retried, and a failure that outlives its retries is reported.
 *
 * REPLAYS THE FINDING, per the replay rule. After shipping e623457 one twin's upload threw
 * `AiSearchInternalError: unable_to_connect_to_ai_search`; the old loop logged it and carried on, the
 * converge read 156 of 157, and ship waited that out as eventual consistency. These make one upload
 * fail, transiently and then for good, and assert the two outcomes the fix exists for.
 *
 * @see app/lib/search/ask-twins.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import { TWIN_ATTEMPTS, uploadTwins, withRetry } from "../app/lib/search/ask-twins.mjs";
import { askSyncReport, askSyncSummary } from "../app/lib/operator/sync-report.mjs";

const TWINS = [
  { key: "publications/10-1128-jvi-02150-14.md", path: "/publications/10-1128-jvi-02150-14.md" },
  { key: "publications/10-1128-mra-01077-21.md", path: "/publications/10-1128-mra-01077-21.md" },
  { key: "publications/10-3389-feduc-2024-1442306.md", path: "/publications/10-3389-feduc-2024-1442306.md" },
];
const FAILING = "publications/10-1128-mra-01077-21.md";

/** The error the production upload threw, by name and message. */
function transient() {
  const e = new Error("unable_to_connect_to_ai_search");
  e.name = "AiSearchInternalError";
  return e;
}

/** An io whose upload of FAILING throws `failures` times, then succeeds. No real waiting. */
function io(failures) {
  const uploads = new Map();
  let thrown = 0;
  const logged = [];
  const slept = [];
  return {
    uploads,
    logged,
    slept,
    thrown: () => thrown,
    fetchText: async (path) => `# twin ${path}`,
    upload: async (key, body) => {
      if (key === FAILING && thrown < failures) {
        thrown += 1;
        throw transient();
      }
      uploads.set(key, body);
    },
    log: (...args) => logged.push(args.join(" ")),
    sleep: async (ms) => {
      slept.push(ms);
    },
  };
}

test("a transient failure is retried and the twin lands", async () => {
  const fake = io(1);
  const { keys, failed } = await uploadTwins(TWINS, fake);
  assert.equal(fake.thrown(), 1, "the plant must actually have thrown once");
  assert.deepEqual(failed, []);
  assert.ok(fake.uploads.has(FAILING), "the retried twin was written");
  assert.equal(fake.uploads.size, TWINS.length);
  assert.deepEqual(keys, TWINS.map((t) => t.key));
  assert.equal(fake.slept.length, 1, "exactly one pause, before the one retry");
});

test("a failure that outlives its retries is reported, not swallowed", async () => {
  const fake = io(Infinity);
  const { keys, failed } = await uploadTwins(TWINS, fake);
  assert.equal(fake.thrown(), TWIN_ATTEMPTS, "every attempt was made before giving up");
  assert.deepEqual(failed, [{ key: FAILING, error: "AiSearchInternalError: unable_to_connect_to_ai_search" }]);
  assert.equal(fake.uploads.size, TWINS.length - 1, "the other twins still landed");
  assert.ok(keys.includes(FAILING), "a failed key stays in keys, so the prune never deletes the indexed copy");
  assert.equal(fake.logged.length, 1);
});

test("the converge report refuses convergence on a failed key, even when the counts agree", async () => {
  const { failed } = await uploadTwins(TWINS, io(Infinity));
  // The counts agreeing is the dangerous case: the old copy is still listed, so nothing else would notice.
  const report = askSyncReport({ uploaded: 156, removed: 0, cacheDropped: 0, expected: 157, present: 157, failed });
  assert.equal(report.converged, false);
  assert.deepEqual(report.failed.map((f) => f.key), [FAILING]);
  assert.match(askSyncSummary(report), /ASK UPLOAD FAILED for 1 key/);
  assert.match(askSyncSummary(report), /10-1128-mra-01077-21/);
});

test("with nothing failed, the report converges exactly as before", () => {
  const report = askSyncReport({ uploaded: 157, removed: 0, cacheDropped: 0, expected: 157, present: 157, failed: [] });
  assert.equal(report.converged, true);
  const legacy = askSyncReport({ uploaded: 157, removed: 0, cacheDropped: 0, expected: 157, present: 157 });
  assert.equal(legacy.converged, true, "a caller that passes no failed list still converges on agreeing counts");
});

test("a twin that cannot be fetched is retried, then reported", async () => {
  let fetches = 0;
  const { failed } = await uploadTwins([TWINS[0]], {
    fetchText: async () => {
      fetches += 1;
      throw new Error("twin /publications/x.md answered 404");
    },
    upload: async () => assert.fail("nothing to upload when the fetch never succeeded"),
    log: () => {},
    sleep: async () => {},
  });
  assert.equal(fetches, TWIN_ATTEMPTS);
  assert.equal(failed.length, 1);
});

test("withRetry backs off by doubling and rethrows the last error", async () => {
  const slept = [];
  let calls = 0;
  await assert.rejects(
    withRetry(
      async () => {
        calls += 1;
        throw new Error(`attempt ${calls}`);
      },
      { attempts: 3, backoffMs: 100, sleep: async (ms) => slept.push(ms) },
    ),
    /attempt 3/,
  );
  assert.deepEqual(slept, [100, 200]);
});
