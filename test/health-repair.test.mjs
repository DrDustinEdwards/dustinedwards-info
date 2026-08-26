/**
 * Whether a failing health run is allowed to repair itself.
 *
 * This decides two things that matter more than most: whether an authenticated
 * WRITE fires against production unattended, and whether a human is woken. The
 * workflow that acts on it is bash inside YAML running on a schedule only when
 * something is already broken, which is the least observable code in this
 * repository. So the decision is a module and these are what exercise it.
 *
 * THE TWO PLANTS THE RULING NAMED, both here by name:
 *   - a non-drift failure must NOT trigger repair
 *   - a drift failure with no secret must STILL fail the run
 *
 * @see scripts/lib/health-repair.mjs
 * @see .github/workflows/health.yml
 */

import test from "node:test";
import assert from "node:assert/strict";

import { REPAIRABLE, failingCheckNames, repairPlan } from "../scripts/lib/health-repair.mjs";

const WITH = { hasToken: true };
const WITHOUT = { hasToken: false };

test("ask drift alone repairs through sync_ask", () => {
  const plan = repairPlan(["ask-index-drift"], WITH);
  assert.deepEqual(plan.repair, ["sync_ask"]);
  assert.equal(plan.alertOnly, false);
  assert.deepEqual(plan.unknown, []);
});

test("media drift alone repairs through sync_media", () => {
  const plan = repairPlan(["media-index-drift"], WITH);
  assert.deepEqual(plan.repair, ["sync_media"]);
  assert.equal(plan.alertOnly, false);
});

test("both drift classes repair both, in a stable order, without duplicates", () => {
  const plan = repairPlan(["media-index-drift", "ask-index-drift", "ask-index-drift"], WITH);
  assert.deepEqual(plan.repair, ["sync_ask", "sync_media"]);
  assert.equal(plan.alertOnly, false);
});

test("PLANT: A NON-DRIFT FAILURE MUST NOT TRIGGER REPAIR", () => {
  /*
   * `fts-equality` and `media-unbacked` are real checks with no automated
   * repair. If either could reach the repair path, an unattended corpus rebuild
   * would fire at something nobody has diagnosed.
   */
  for (const name of ["fts-equality", "media-unbacked", "something-new-nobody-classified"]) {
    const plan = repairPlan([name], WITH);
    assert.deepEqual(plan.repair, [], `${name} must not repair`);
    assert.equal(plan.alertOnly, true, `${name} must alert`);
    assert.deepEqual(plan.unknown, [name]);
    assert.match(plan.reason, /not a known drift class/);
  }
});

test("PLANT: A MIXED SET REPAIRS NOTHING, not even the class it recognises", () => {
  /*
   * The subtle half of the plant above. A compound failure may share a root
   * cause, so the recognised class is NOT repaired alongside an unrecognised
   * one: firing a rebuild into a system broken in an unclassified way is how an
   * incident becomes a bigger one.
   */
  const plan = repairPlan(["ask-index-drift", "fts-equality"], WITH);
  assert.deepEqual(plan.repair, []);
  assert.equal(plan.alertOnly, true);
  assert.deepEqual(plan.unknown, ["fts-equality"]);
});

test("PLANT: A DRIFT FAILURE WITH NO SECRET STILL FAILS THE RUN", () => {
  /*
   * Degrading to alert-only is correct. Degrading to silence is not: a monitor
   * that quietly lost the ability to act looks exactly like one that never
   * needed to.
   */
  const plan = repairPlan(["ask-index-drift"], WITHOUT);
  assert.deepEqual(plan.repair, []);
  assert.equal(plan.alertOnly, true);
  assert.match(plan.reason, /OPERATOR_TOKEN is not set/);
  // And it names the one-time fix, because an alert that does not say what to
  // do is a second thing to look up at 2am.
  assert.match(plan.reason, /gh secret set OPERATOR_TOKEN/);
});

test("an unknown class beats a missing token in the reason, so the log names the real blocker", () => {
  // Both refusals apply. The unknown class is the one a person must act on;
  // the missing secret would be a misleading thing to lead with.
  const plan = repairPlan(["fts-equality"], WITHOUT);
  assert.equal(plan.alertOnly, true);
  assert.match(plan.reason, /not a known drift class/);
  assert.doesNotMatch(plan.reason, /OPERATOR_TOKEN/);
});

test("NO FAILING CHECK NAMED IS NOT A REASON TO WRITE", () => {
  // ok:false with an empty list is a contradiction in the endpoint. Repairing
  // on the basis of an empty list would be a write with no reason, which is the
  // empty-scope class this repo refuses everywhere else.
  for (const empty of [[], null, undefined, "ask-index-drift", 7, {}]) {
    const plan = repairPlan(empty, WITH);
    assert.deepEqual(plan.repair, [], `${JSON.stringify(empty)} must not repair`);
    assert.equal(plan.alertOnly, true);
  }
  assert.match(repairPlan([], WITH).reason, /nothing to repair/);
});

test("a non-string in the failing list cannot smuggle itself past the classifier", () => {
  const plan = repairPlan(["ask-index-drift", null, 42, ""], WITH);
  // The junk is dropped rather than treated as an unknown class, and the real
  // drift still repairs.
  assert.deepEqual(plan.repair, ["sync_ask"]);
  assert.equal(plan.alertOnly, false);
});

test("every repairable class maps to a tool that goes through the front door", () => {
  // Rule 18 as an assertion: the value is an operator TOOL NAME, never anything
  // that writes a row. A future entry pointing at a direct write would fail.
  for (const [name, tool] of Object.entries(REPAIRABLE)) {
    assert.match(name, /-drift$/, `${name} should be a drift class`);
    assert.match(tool, /^sync_/, `${tool} should be a sync operation`);
  }
});

/* ---- failingCheckNames --------------------------------------------------- */

test("failing names are read from the body, passing ones ignored", () => {
  const body = {
    ok: false,
    checks: [
      { name: "ask-index-drift", ok: false, expected: 99, present: 90 },
      { name: "fts-equality", ok: true },
      { name: "media-index-drift", ok: false, expected: 69, present: 68 },
    ],
  };
  assert.deepEqual(failingCheckNames(body), ["ask-index-drift", "media-index-drift"]);
});

test("A CHECK MISSING ok IS NOT COUNTED AS FAILING", () => {
  // `ok === false` rather than `!ok`. A body whose shape changed is unreadable,
  // and unreadable must route to alert-only rather than to a repair decided on
  // a field that was not there.
  const body = { ok: false, checks: [{ name: "mystery" }, { name: "other", ok: null }] };
  assert.deepEqual(failingCheckNames(body), []);
  assert.equal(repairPlan(failingCheckNames(body), WITH).alertOnly, true);
});

test("an unreadable body yields no names, and therefore no repair", () => {
  for (const body of [null, undefined, {}, { checks: "nope" }, { checks: null }, []]) {
    assert.deepEqual(failingCheckNames(body), [], JSON.stringify(body));
    assert.equal(repairPlan(failingCheckNames(body), WITH).alertOnly, true);
  }
});

test("THE FULL PATH: a real drifted body decides to repair both", () => {
  // The shape /api/health actually returns when both indexes have drifted,
  // including the two counts publicHealthBody opts onto the wire for failures.
  const body = {
    ok: false,
    checks: [
      { name: "ask-index-drift", ok: false, expected: 99, present: 90 },
      { name: "media-index-drift", ok: false, expected: 69, present: 68 },
      { name: "media-unbacked", ok: true },
      { name: "fts-equality", ok: true },
    ],
  };
  const plan = repairPlan(failingCheckNames(body), WITH);
  assert.deepEqual(plan.repair, ["sync_ask", "sync_media"]);
  assert.equal(plan.alertOnly, false);
});

test("content drift repairs BEFORE the ask index when both fail", () => {
  // sync_posts rewrites the search_docs rows the ask upload reads from, so
  // the map order in REPAIRABLE is load-bearing: reversed, the upload would
  // push the stale corpus and then fix it. The endpoint's own listing order
  // must not matter either, which is why the names arrive reversed here.
  const plan = repairPlan(["ask-index-drift", "content-drift"], WITH);
  assert.deepEqual(plan.repair, ["sync_posts", "sync_ask"]);
  assert.equal(plan.alertOnly, false);
});
