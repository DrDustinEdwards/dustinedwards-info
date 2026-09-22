/**
 * Ship's reading of `sync:content`, replayed from the ship of 9c2c247 (2026-09-22) that refused a
 * sync which had converged: the first run failed on a network error after reporting render drift,
 * the confirming run succeeded, and ship read the counts line from the first.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { driftCount, searchCounts } from "../scripts/lib/sync-verdict.mjs";

/** The first run, abridged from the transcript: drift reported, then a failed import, no counts. */
const FIRST = [
  "sync:content drift: unchanged=12 source-changed=0 render-drift=3 missing-in-d1=0 extra-in-d1=0",
  "sync:content applying 15 posts to remote D1",
  "sync:content applying 200 search records",
  "X [ERROR] fetch failed",
  "sync:content failed. wrangler d1 execute failed for the search index",
].join("\n");

/** The confirming run, verbatim from the transcript. */
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
  const ship = readFileSync(new URL("../scripts/ship.mjs", import.meta.url), "utf8");
  assert.match(ship, /standing = confirm;/, "the confirming run must become the standing one");
  assert.match(ship, /searchCounts\(standing\.text\)/, "the counts must be read from the standing run");
  assert.doesNotMatch(ship, /searchCounts\(sync\.text\)/, "reading the first run is the defect replayed here");
});
