import test from "node:test";
import assert from "node:assert/strict";

import {
  ASK_UPLOAD_ATTEMPTS,
  askUploadsNeeded,
  mapPool,
  uploadAskItems,
} from "../app/lib/search/ask-twins.mjs";
import { askSyncReport, askSyncSummary } from "../app/lib/operator/sync-report.mjs";

const TWINS = [
  {
    key: "research/publications/10-1128-jvi-02150-14.md",
    body: "# twin 10-1128-jvi-02150-14",
  },
  {
    key: "research/publications/10-1128-mra-01077-21.md",
    body: "# twin 10-1128-mra-01077-21",
  },
  {
    key: "research/publications/10-3389-feduc-2024-1442306.md",
    body: "# twin 10-3389-feduc-2024-1442306",
  },
];
const FAILING = "research/publications/10-1128-mra-01077-21.md";

function transient() {
  const e = new Error("unable_to_connect_to_ai_search");
  e.name = "AiSearchInternalError";
  return e;
}

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

await test("a transient failure is retried and the item lands", async () => {
  const fake = io(1);
  const { uploaded, failed } = await uploadAskItems(TWINS, fake);
  assert.equal(fake.thrown(), 1, "the plant must actually have thrown once");
  assert.deepEqual(failed, []);
  assert.ok(fake.uploads.has(FAILING), "the retried twin was written");
  assert.equal(fake.uploads.size, TWINS.length);
  assert.deepEqual([...uploaded].sort(), TWINS.map((t) => t.key).sort());
  assert.equal(fake.slept.length, 1, "exactly one pause, before the one retry");
});

await test("a failure that outlives its retries is reported, not swallowed", async () => {
  const fake = io(Infinity);
  // Resolves rather than rejects: one key's failure once turned the whole sync into a 500.
  const { uploaded, failed } = await uploadAskItems(TWINS, fake);
  assert.equal(fake.thrown(), ASK_UPLOAD_ATTEMPTS, "every attempt was made before giving up");
  assert.deepEqual(failed, [
    { key: FAILING, error: "AiSearchInternalError: unable_to_connect_to_ai_search" },
  ]);
  assert.equal(fake.uploads.size, TWINS.length - 1, "the other items still landed");
  assert.ok(!uploaded.includes(FAILING), "a failed key is never recorded in the ledger");
  assert.equal(fake.logged.length, 1);
});

await test("the converge report refuses convergence on a failed key, even when the counts agree", async () => {
  const { failed } = await uploadAskItems(TWINS, io(Infinity));
  // The counts agreeing is the dangerous case: the old copy is still listed, so nothing else would notice.
  const report = askSyncReport({
    uploaded: 156,
    removed: 0,
    cacheDropped: 0,
    expected: 157,
    present: 157,
    failed,
  });
  assert.equal(report.converged, false);
  assert.deepEqual(
    report.failed.map((f) => f.key),
    [FAILING],
  );
  assert.match(askSyncSummary(report), /ASK UPLOAD FAILED for 1 key/);
  assert.match(askSyncSummary(report), /10-1128-mra-01077-21/);
});

await test("only a changed, missing or unhealthy item is uploaded again", () => {
  const items = [
    { key: "a.md", hash: "h1" },
    { key: "b.md", hash: "h2" },
    { key: "c.md", hash: "h3" },
    { key: "d.md", hash: "h4" },
    { key: "e.md", hash: "h5" },
  ];
  const listed = [
    { key: "a.md", status: "completed" },
    { key: "b.md", status: "completed" },
    { key: "c.md", status: "error" },
    { key: "e.md", status: "queued" },
  ];
  const ledger = new Map([
    ["a.md", "h1"],
    ["b.md", "old"],
    ["c.md", "h3"],
    ["d.md", "h4"],
    ["e.md", "h5"],
  ]);
  assert.deepEqual(
    askUploadsNeeded(items, listed, ledger).map((i) => i.key),
    // b changed, c failed to index, d is in the ledger but not the index (a row is never proof alone).
    ["b.md", "c.md", "d.md"],
  );
  assert.equal(askUploadsNeeded(items, listed, new Map()).length, 5, "an empty ledger uploads all");
});

await test("mapPool never exceeds its limit, keeps order, and stops starting work after a failure", async () => {
  let inFlight = 0;
  let peak = 0;
  const out = await mapPool([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight -= 1;
    return n * 2;
  });
  assert.deepEqual(out, [2, 4, 6, 8, 10, 12, 14]);
  assert.equal(peak, 3);

  const started = [];
  await assert.rejects(
    mapPool([1, 2, 3, 4, 5, 6], 2, async (n) => {
      started.push(n);
      if (n === 2) throw new Error("boom");
      await new Promise((r) => setTimeout(r, 5));
    }),
    /boom/,
  );
  assert.ok(started.length < 6, "no new work starts once one call has failed");
});
