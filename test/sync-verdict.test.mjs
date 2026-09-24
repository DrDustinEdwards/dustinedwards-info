import test from "node:test";
import assert from "node:assert/strict";

import { driftCount, searchCounts, standingRun } from "../scripts/lib/sync-verdict.mjs";

const FIRST = [
  "sync:content drift: unchanged=12 source-changed=0 render-drift=3 missing-in-d1=0 extra-in-d1=0",
  "sync:content applying 15 posts to remote D1",
  "sync:content applying 200 search records",
  "X [ERROR] fetch failed",
  "sync:content failed. wrangler d1 execute failed for the search index",
].join("\n");

const CONFIRM = [
  "sync:content drift: unchanged=15 source-changed=0 render-drift=0 missing-in-d1=0 extra-in-d1=0",
  "sync:content applying 15 posts to remote D1",
  "sync:content applying llms.txt (7687 bytes)",
  "sync:content applying 200 search records",
  "sync:content posts=15 posts_fts=15 tags=32 post_tags=61",
  "sync:content search_docs=200 identity=200 prose=200",
  "sync:content ok. FTS and search index row counts match.",
].join("\n");

test("the first run carries drift and no counts, which is what ship refused on", () => {
  assert.equal(driftCount(FIRST), 3);
  assert.equal(searchCounts(FIRST), null);
});

test("the confirming run carries zero drift and the counts", () => {
  assert.equal(driftCount(CONFIRM), 0);
  assert.deepEqual(searchCounts(CONFIRM), ["200", "200", "200"]);
});

test("a run with no drift line reads as null, not zero", () => {
  assert.equal(driftCount("sync:content failed before the drift pass"), null);
});

test("ship reads the counts from the run that wrote last, not the first", () => {
  const first = { code: 1, text: FIRST };
  const confirm = { code: 0, text: CONFIRM };
  assert.deepEqual(searchCounts(standingRun(first, confirm).text), ["200", "200", "200"]);
  assert.equal(searchCounts(standingRun(first, null).text), null, "with no confirming run, the first stands");
});
