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
 * @see app/lib/health/repair.mjs
 * @see .github/workflows/health.yml
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  REPAIRABLE,
  failingCheckNames,
  repairPlan,
  watchdogActions,
  watchdogOutcome,
} from "../app/lib/health/repair.mjs";

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

test("the mirror is repairable, because a copy cannot lose anything", () => {
  // ADDED 2026-09-01 with `media-backup-drift`. It is the fourth repairable
  // class and the only one whose repair has no destructive branch: it copies
  // MEDIA to MEDIA_BACKUP and never deletes from either.
  const plan = repairPlan(["media-backup-drift"], WITH);
  assert.deepEqual(plan.repair, ["backup_media"]);
  assert.equal(plan.alertOnly, false);
  assert.deepEqual(plan.unknown, []);
});

test("the mirror repair joins the others without disturbing their order", () => {
  const plan = repairPlan(
    ["media-backup-drift", "content-drift", "ask-index-drift"],
    WITH,
  );
  // Content before Ask is load bearing (sync_posts rewrites what sync_ask
  // reads); the mirror is order-independent and simply lands last.
  assert.deepEqual(plan.repair, ["sync_posts", "sync_ask", "backup_media"]);
});

test("PLANT: A NON-DRIFT FAILURE MUST NOT TRIGGER REPAIR", () => {
  /*
   * `fts-equality` is a real check with no automated repair. If it could reach
   * the repair path, an unattended corpus rebuild would fire at something
   * nobody has diagnosed.
   *
   * `media-unbacked` used to sit in this list and is GONE, replaced by
   * `media-backup-drift` on 2026-09-01. It is named here anyway, as a retired
   * class: a check that no longer exists must still be treated as unknown
   * rather than quietly matched, because a stale caller naming it is exactly
   * the case where firing a repair would be wrong.
   */
  for (const name of [
    "fts-equality",
    "media-unbacked",
    "something-new-nobody-classified",
  ]) {
    const plan = repairPlan([name], WITH);
    assert.deepEqual(plan.repair, [], `${name} must not repair`);
    assert.equal(plan.alertOnly, true, `${name} must alert`);
    assert.deepEqual(plan.unknown, [name]);
    assert.match(plan.reason, /not a known drift class/);
  }
});

test("PLANT: A MIXED SET REPAIRS NOTHING, not even the class it recognizes", () => {
  /*
   * The subtle half of the plant above. A compound failure may share a root
   * cause, so the recognized class is NOT repaired alongside an unrecognised
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
  /*
   * Rule 18 as an assertion: the value is an operator TOOL NAME, never anything
   * that writes a row. A future entry pointing at a direct write would fail.
   *
   * WIDENED 2026-09-01 from `/^sync_/`. `backup_media` is the fourth repairable
   * class and it is not a sync: a sync converges a DERIVED store to its source,
   * and this copies bytes to a second bucket that nothing derives from. The
   * assertion is the verb allowlist rather than one prefix, because the
   * property being protected was never the word "sync": it is that the repair
   * is an operator operation with a door, and that its verb is one that cannot
   * be mistaken for a direct write.
   */
  const REPAIR_VERBS = ["sync", "backup"];
  for (const [name, tool] of Object.entries(REPAIRABLE)) {
    assert.match(name, /-drift$/, `${name} should be a drift class`);
    const verb = tool.split("_")[0];
    assert.ok(
      REPAIR_VERBS.includes(verb),
      `${tool} should be one of ${REPAIR_VERBS.join(", ")}, got verb ${JSON.stringify(verb)}`,
    );
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
      { name: "media-backup-drift", ok: true },
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

/*
 * ===========================================================================
 * THE WATCHDOG'S ACTION LIST
 * ===========================================================================
 *
 * `workers/watchdog.ts` is a Cron Trigger. It runs unattended, every fifteen
 * minutes, and the only firings whose behavior matters are the ones where the
 * site is already broken, which is precisely when nobody is watching the run.
 * Everything it DECIDES is here so that something can fail when it changes.
 *
 * TWO PLANTS ARE NAMED BELOW, in the shape the replay rule requires: each says in
 * advance which assertion must fire, so a non-zero exit is not mistaken for
 * proof.
 */

/** The healthy body the endpoint actually returns, trimmed to what is read. */
const HEALTHY = {
  ok: true,
  checks: [
    { name: "ask-index-drift", ok: true },
    { name: "media-index-drift", ok: true },
    { name: "media-backup-drift", ok: true },
    { name: "content-drift", ok: true },
    { name: "fts-equality", ok: true },
  ],
};

/** @param {string[]} failing */
const bodyFailing = (failing) => ({
  ok: false,
  checks: [
    { name: "fts-equality", ok: true },
    ...failing.map((name) => ({ name, ok: false })),
  ],
});

/** @param {unknown} action */
const reasonOf = (action) => /** @type {{ reason: string }} */ (action).reason;

test("ok in means NO action at all", () => {
  assert.deepEqual(watchdogActions({ status: 200, body: HEALTHY }, WITH), []);
});

test("a 200 carrying ok:false is NOT healthy", () => {
  // The status line and the body can disagree, and the body is the verdict.
  const actions = watchdogActions({ status: 200, body: bodyFailing(["ask-index-drift"]) }, WITH);
  assert.deepEqual(actions, [{ type: "repair", tool: "sync_ask" }, { type: "recheck" }]);
});

test("PLANT: A REPAIRABLE FAILURE IS REPAIR THEN RECHECK, in that order", () => {
  /*
   * PLANT: delete the `{ type: "recheck" }` entry from the array
   * `watchdogActions` returns. THIS assertion is the one that must fire, and it
   * must name the missing recheck rather than merely exiting 1.
   *
   * The recheck is what turns "the repair call returned 200" into "the endpoint
   * agrees", and it is the step a later simplification would drop first,
   * because the repair already derives its own converged verdict and looks
   * sufficient. It is not: it proves ONE index, not the run.
   */
  const actions = watchdogActions(
    { status: 503, body: bodyFailing(["content-drift", "ask-index-drift"]) },
    WITH,
  );
  assert.deepEqual(actions, [
    { type: "repair", tool: "sync_posts" },
    { type: "repair", tool: "sync_ask" },
    { type: "recheck" },
  ]);
  assert.equal(actions.at(-1)?.type, "recheck", "the recheck must be LAST, after every repair");
  assert.equal(
    actions.filter((a) => a.type === "recheck").length,
    1,
    "exactly one recheck: a loop here would be a monitor arguing with itself",
  );
});

test("PLANT: AN UNKNOWN CLASS PRODUCES A NOTIFY ACTION NAMING THE CLASS", () => {
  /*
   * PLANT: drop the joined `unknown` list from the unknown-class reason in
   * `repairPlan`. THIS assertion is the one that must fire, on the
   * `telemetry-sink-empty` match rather than on the type check above it.
   *
   * A notification that says "something unclassified failed" and does not say
   * WHAT is an alert that costs a person the whole triage. The class name is
   * the entire actionable content of the mail.
   */
  const actions = watchdogActions(
    { status: 503, body: bodyFailing(["telemetry-sink-empty"]) },
    WITH,
  );
  assert.equal(actions.length, 1);
  assert.equal(actions[0]?.type, "notify");
  assert.match(
    reasonOf(actions[0]),
    /telemetry-sink-empty/,
    "the notify reason must NAME the unclassified check",
  );
  assert.match(reasonOf(actions[0]), /not a known drift class/);
});

test("an unknown class alongside a repairable one still repairs NOTHING", () => {
  const actions = watchdogActions(
    { status: 503, body: bodyFailing(["ask-index-drift", "telemetry-sink-empty"]) },
    WITH,
  );
  assert.equal(actions.length, 1);
  assert.equal(actions[0]?.type, "notify");
  assert.equal(actions.filter((a) => a.type === "repair").length, 0);
});

test("no token means notify, never a silent pass", () => {
  const actions = watchdogActions({ status: 503, body: bodyFailing(["ask-index-drift"]) }, WITHOUT);
  assert.deepEqual(actions.map((a) => a.type), ["notify"]);
  assert.match(reasonOf(actions[0]), /OPERATOR_TOKEN is not set/);
});

test("a throttled watchdog notifies rather than reporting the site unhealthy", () => {
  /*
   * `/api/health` answers 429 with a body naming `rate-limited`, which is
   * deliberately NOT a repairable class, so it falls to the unknown arm and
   * wakes somebody NAMING the throttle. Measured on the wire 2026-08-29: a
   * burst through the service binding is refused in exactly that shape.
   */
  const actions = watchdogActions(
    { status: 429, body: { ok: false, checks: [{ name: "rate-limited", ok: false }] } },
    WITH,
  );
  assert.deepEqual(actions.map((a) => a.type), ["notify"]);
  assert.match(reasonOf(actions[0]), /rate-limited/);
});

test("an unreadable body notifies rather than writing", () => {
  for (const body of [null, "not json", {}, { ok: false }, { ok: false, checks: "nope" }]) {
    const actions = watchdogActions({ status: 503, body }, WITH);
    assert.deepEqual(actions.map((a) => a.type), ["notify"], `body ${JSON.stringify(body)}`);
  }
});

test("a total outage (no body at all) notifies, and says the cause is missing", () => {
  /*
   * THE REASON MOVED 2026-09-11 and this assertion moved with it.
   *
   * A status of 0 is a TRANSPORT failure, and `watchdogActions` now branches
   * on it ahead of `repairPlan` so the mail can name what went wrong: DNS
   * failure, a timeout and a Cloudflare 1042 used to arrive here
   * indistinguishable, and the page somebody got at 2am said only that no
   * failing check was named, about a request that never happened.
   *
   * This case constructs the reading BY HAND, so it carries no `error`, which
   * is the arm that reports the cause as missing. `test/worker/watchdog.test.ts`
   * covers the arm where `readHealth` supplies one.
   *
   * The claim that matters is unchanged and is still asserted first: a total
   * outage NOTIFIES and repairs nothing. `repairPlan([])` keeps its own
   * "nothing to repair" wording and its own case above, because that function
   * did not change.
   */
  const actions = watchdogActions({ status: 0, body: null }, WITH);
  assert.deepEqual(actions.map((a) => a.type), ["notify"]);
  assert.match(reasonOf(actions[0]), /could not be reached/);
  assert.match(reasonOf(actions[0]), /Nothing was repaired/);
  assert.match(reasonOf(actions[0]), /carried no cause/);
});

test("a clean outcome is NO action", () => {
  assert.deepEqual(watchdogOutcome({ misses: [], recheck: { status: 200, body: HEALTHY } }), []);
});

test("a failed repair notifies and names the miss", () => {
  const actions = watchdogOutcome({
    misses: ["sync_ask answered 500"],
    recheck: { status: 200, body: HEALTHY },
  });
  assert.deepEqual(actions.map((a) => a.type), ["notify"]);
  assert.match(reasonOf(actions[0]), /sync_ask answered 500/);
});

test("a repair that converged but left the endpoint unhealthy still notifies", () => {
  const actions = watchdogOutcome({
    misses: [],
    recheck: { status: 503, body: bodyFailing(["ask-index-drift"]) },
  });
  assert.deepEqual(actions.map((a) => a.type), ["notify"]);
  assert.match(reasonOf(actions[0]), /STILL unhealthy/);
  assert.match(reasonOf(actions[0]), /ask-index-drift/);
});

test("BOTH faults are reported, never just the first", () => {
  /*
   * The N-1-of-N shape FAILURES.md opens with. A mail naming only the failed
   * repair sends somebody to re-run it and never mentions that the endpoint is
   * still unhealthy for a different reason.
   */
  const actions = watchdogOutcome({
    misses: ["sync_media answered 500"],
    recheck: { status: 503, body: bodyFailing(["content-drift"]) },
  });
  const reason = reasonOf(actions[0]);
  assert.match(reason, /sync_media answered 500/);
  assert.match(reason, /STILL unhealthy/);
  assert.match(reason, /content-drift/);
});

test("a recheck that never completed notifies rather than passing", () => {
  const actions = watchdogOutcome({ misses: [], recheck: null });
  assert.deepEqual(actions.map((a) => a.type), ["notify"]);
  assert.match(reasonOf(actions[0]), /proved nothing/);
});

test("the decision module does no I/O", async () => {
  /*
   * ASSERTED, not left to prose. This module is imported into a Worker bundle,
   * into a Node script and into this file, and the property that makes it
   * testable at all is that it does no I/O. A `fetch` added here would still
   * pass every assertion above.
   *
   * The source is read and its length asserted first: an empty read passes
   * every doesNotMatch below it vacuously.
   */
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../app/lib/health/repair.mjs", import.meta.url), "utf8");
  assert.ok(source.length > 2000, `read ${source.length} chars; an empty read passes vacuously`);
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(code.length > 1000, `stripped to ${code.length} chars; the stripper ate the module`);
  assert.doesNotMatch(code, /\bfetch\s*\(/, "the module must never fetch");
  assert.doesNotMatch(code, /^\s*import\s/m, "the module must import nothing");
});
