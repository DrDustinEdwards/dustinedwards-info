/**
 * The home health fact's shape, as `check:browser` asserts it.
 *
 * REPLAYS THE DEFECT, per hard rule 12: the case expected `2/5` while the page renders
 * `2/5 passing`, so it could never pass. The old expectation is here as a value the predicate must
 * now refuse, beside the real text it must accept.
 *
 * @see scripts/lib/health-tile.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import { freshHealthRatio } from "../scripts/lib/health-tile.mjs";

test("the text the home page renders is accepted", () => {
  assert.deepEqual(freshHealthRatio("2/5 passing"), { passed: 2, total: 5 });
  assert.deepEqual(freshHealthRatio("5/5 passing"), { passed: 5, total: 5 });
});

test("THE OLD EXPECTATION, a bare ratio, is not what the page renders", () => {
  assert.equal(freshHealthRatio("2/5"), null);
});

test("the stale and missing states, and impossible counts, are refused", () => {
  for (const wrong of ["-- passing", "--", "6/5 passing", "0/0 passing", "2/5 passing!", "", null, undefined]) {
    assert.equal(freshHealthRatio(wrong), null, JSON.stringify(wrong));
  }
});
