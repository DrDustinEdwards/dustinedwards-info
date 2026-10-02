import test from "node:test";
import assert from "node:assert/strict";

import { ASK_POLL_INTERVAL_MS, ASK_POLL_WINDOW_MS } from "../app/lib/health/ask-converge.mjs";
import {
  failingCheckNames,
  repairPlan,
  settleAskRecheck,
  watchdogActions,
  watchdogOutcome,
} from "../app/lib/health/repair.mjs";
import { bodyDrifted, bodyFailing, HEALTHY } from "./lib/health-bodies.mjs";

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
  // The only repair with no destructive branch: it copies MEDIA to MEDIA_BACKUP and deletes
  // from neither.
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
  /* `fts-equality` has no automated repair, and `media-unbacked` is a retired class: a stale
   * caller naming it is exactly the case where firing a repair would be wrong. */
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
  /* A compound failure may share a root cause, so the recognized class is not repaired
   * alongside an unrecognized one. */
  const plan = repairPlan(["ask-index-drift", "fts-equality"], WITH);
  assert.deepEqual(plan.repair, []);
  assert.equal(plan.alertOnly, true);
  assert.deepEqual(plan.unknown, ["fts-equality"]);
});

test("PLANT: A DRIFT FAILURE WITH NO SECRET STILL FAILS THE RUN", () => {
  /* A monitor that quietly lost the ability to act looks exactly like one that never needed to. */
  const plan = repairPlan(["ask-index-drift"], WITHOUT);
  assert.deepEqual(plan.repair, []);
  assert.equal(plan.alertOnly, true);
  assert.match(plan.reason, /OPERATOR_TOKEN is not set/);
  assert.match(plan.reason, /gh secret set OPERATOR_TOKEN/);
});

test("an unknown class beats a missing token in the reason, so the log names the real blocker", () => {
  const plan = repairPlan(["fts-equality"], WITHOUT);
  assert.equal(plan.alertOnly, true);
  assert.match(plan.reason, /not a known drift class/);
  assert.doesNotMatch(plan.reason, /OPERATOR_TOKEN/);
});

test("NO FAILING CHECK NAMED IS NOT A REASON TO WRITE", () => {
  // ok:false with an empty list is a contradiction, and repairing on it is a write with no reason.
  for (const empty of [[], null, undefined, "ask-index-drift", 7, {}]) {
    const plan = repairPlan(empty, WITH);
    assert.deepEqual(plan.repair, [], `${JSON.stringify(empty)} must not repair`);
    assert.equal(plan.alertOnly, true);
  }
  assert.match(repairPlan([], WITH).reason, /nothing to repair/);
});

test("a non-string in the failing list cannot smuggle itself past the classifier", () => {
  const plan = repairPlan(["ask-index-drift", null, 42, ""], WITH);
  assert.deepEqual(plan.repair, ["sync_ask"]);
  assert.equal(plan.alertOnly, false);
});

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
  // `ok === false` rather than `!ok`: a body whose shape changed must route to alert-only, not
  // to a repair decided on a field that was not there.
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

test("content drift repairs BEFORE the ask index when both fail", () => {
  // sync_posts rewrites the search_docs rows the ask upload reads, so the order is load-bearing.
  // The names arrive reversed to prove the endpoint's listing order does not matter.
  const plan = repairPlan(["ask-index-drift", "content-drift"], WITH);
  assert.deepEqual(plan.repair, ["sync_posts", "sync_ask"]);
  assert.equal(plan.alertOnly, false);
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
  /* The recheck turns "the repair returned 200" into "the endpoint agrees": a repair's own
   * verdict proves ONE index, not the run. Exactly one recheck, LAST, after every repair: a loop
   * here would be a monitor arguing with itself. */
  const actions = watchdogActions(
    { status: 503, body: bodyFailing(["content-drift", "ask-index-drift"]) },
    WITH,
  );
  assert.deepEqual(actions, [
    { type: "repair", tool: "sync_posts" },
    { type: "repair", tool: "sync_ask" },
    { type: "recheck" },
  ]);
});

test("PLANT: AN UNKNOWN CLASS PRODUCES A NOTIFY ACTION NAMING THE CLASS", () => {
  /* The class name is the entire actionable content of the mail. */
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
  /* A 429 names `rate-limited`, deliberately not a repairable class, so it falls to the unknown
   * arm and the mail names the throttle. */
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
  /* Built by hand, so the reading carries no `error`; `test/worker/watchdog.test.ts` covers
   * the arm where `readHealth` supplies one. */
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
  /* A mail naming only the failed repair would never mention that the endpoint is still
   * unhealthy for a different reason. */
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


/* The watchdog's own sync_ask re-uploads the corpus, and the index can list short for about a minute
 * afterwards: deploy run 36274700184 read 157 then 155. Time moves only when the loop sleeps. */
const settleClock = () => {
  const state = { t: 1_000_000 };
  return { now: () => state.t, sleep: async (ms) => void (state.t += ms), state };
};
const short = (present) => ({ status: 503, body: bodyDrifted({ "ask-index-drift": { expected: 157, present } }) });

test("THE LATE COUNT: a short Ask index after the watchdog's own sync_ask settles, and nothing alerts", async () => {
  const clock = settleClock();
  const reads = [short(156), { status: 200, body: HEALTHY }];
  const { reading, polls } = await settleAskRecheck({
    recheck: short(155),
    attempted: ["sync_ask"],
    reread: async () => reads.shift() ?? { status: 200, body: HEALTHY },
    sleep: clock.sleep,
    now: clock.now,
  });
  assert.equal(polls, 2);
  assert.equal(reading?.status, 200);
  assert.deepEqual(watchdogOutcome({ misses: [], recheck: reading }), []);
});

test("THE REAL SHORTFALL: a count that never arrives still alerts, and the alert names the counts", async () => {
  const clock = settleClock();
  const { reading, polls } = await settleAskRecheck({
    recheck: short(155),
    attempted: ["sync_ask"],
    reread: async () => short(154),
    sleep: clock.sleep,
    now: clock.now,
  });
  assert.ok(polls > 1 && clock.state.t - 1_000_000 <= ASK_POLL_WINDOW_MS + ASK_POLL_INTERVAL_MS);
  const actions = watchdogOutcome({ misses: [], recheck: reading });
  assert.deepEqual(actions.map((a) => a.type), ["notify"]);
  assert.match(reasonOf(actions[0]), /ask-index-drift \(expected 157, present 154\)/);
});

test("a re-check is not waited on when sync_ask did not run, or when the Ask row is not failing", async () => {
  let rereads = 0;
  const reread = async () => {
    rereads += 1;
    return { status: 200, body: HEALTHY };
  };
  const clock = settleClock();
  await settleAskRecheck({ recheck: short(155), attempted: ["sync_media"], reread, ...clock });
  await settleAskRecheck({
    recheck: { status: 503, body: bodyFailing(["media-index-drift"]) },
    attempted: ["sync_ask", "sync_media"],
    reread,
    ...clock,
  });
  assert.equal(rereads, 0);
});

test("a re-read that never arrived does not replace the last real reading", async () => {
  const clock = settleClock();
  const { reading } = await settleAskRecheck({
    recheck: short(155),
    attempted: ["sync_ask"],
    reread: async () => ({ status: 0, body: null, error: "timeout" }),
    sleep: clock.sleep,
    now: clock.now,
  });
  assert.equal(reading?.status, 503);
  assert.match(reasonOf(watchdogOutcome({ misses: [], recheck: reading })[0]), /present 155/);
});

test("procedure drift repairs through sync_procedures, after posts and before the Ask upload", () => {
  const alone = repairPlan(["procedures-drift"], WITH);
  assert.deepEqual(alone.repair, ["sync_procedures"]);
  assert.equal(alone.alertOnly, false);

  // sync_procedures rewrites search_docs rows that sync_ask uploads, so it lands before it.
  const all = repairPlan(["ask-index-drift", "procedures-drift", "content-drift"], WITH);
  assert.deepEqual(all.repair, ["sync_posts", "sync_procedures", "sync_ask"]);

  const actions = watchdogActions(
    { status: 503, body: bodyFailing(["procedures-drift"]) },
    WITH,
  );
  assert.deepEqual(actions, [{ type: "repair", tool: "sync_procedures" }, { type: "recheck" }]);
});

test("dictionary drift repairs through sync_dictionary, before the pages it refreshes and the Ask upload", () => {
  assert.deepEqual(repairPlan(["dictionary-drift"], WITH).repair, ["sync_dictionary"]);
  const all = repairPlan(["ask-index-drift", "pages-drift", "dictionary-drift", "procedures-drift", "content-drift"], WITH);
  assert.deepEqual(all.repair, ["sync_posts", "sync_procedures", "sync_dictionary", "sync_pages", "sync_ask"]);
  assert.equal(all.alertOnly, false);
  const actions = watchdogActions({ status: 503, body: bodyFailing(["dictionary-drift"]) }, WITH);
  assert.deepEqual(actions, [{ type: "repair", tool: "sync_dictionary" }, { type: "recheck" }]);
});

test("page, publication and CV drift repair after procedures and before the Ask upload", () => {
  assert.deepEqual(repairPlan(["pages-drift"], WITH).repair, ["sync_pages"]);
  assert.deepEqual(repairPlan(["publications-drift"], WITH).repair, ["sync_publications"]);
  assert.deepEqual(repairPlan(["cv-drift"], WITH).repair, ["sync_cv"]);

  // All of them rewrite search_docs rows that sync_ask uploads, so each lands before it.
  const all = repairPlan(
    ["ask-index-drift", "cv-drift", "publications-drift", "pages-drift", "procedures-drift", "content-drift"],
    WITH,
  );
  assert.deepEqual(all.repair, ["sync_posts", "sync_procedures", "sync_pages", "sync_publications", "sync_cv", "sync_ask"]);
  assert.equal(all.alertOnly, false);

  const actions = watchdogActions({ status: 503, body: bodyFailing(["pages-drift"]) }, WITH);
  assert.deepEqual(actions, [{ type: "repair", tool: "sync_pages" }, { type: "recheck" }]);
});

test("llms drift repairs through sync_llms, with the other file-derived stores", () => {
  assert.deepEqual(repairPlan(["llms-drift"], WITH).repair, ["sync_llms"]);

  const all = repairPlan(["ask-index-drift", "llms-drift", "publications-drift", "content-drift"], WITH);
  assert.deepEqual(all.repair, ["sync_posts", "sync_publications", "sync_llms", "sync_ask"]);
  assert.equal(all.alertOnly, false);

  const actions = watchdogActions({ status: 503, body: bodyFailing(["llms-drift"]) }, WITH);
  assert.deepEqual(actions, [{ type: "repair", tool: "sync_llms" }, { type: "recheck" }]);
});

test("phage drift repairs through sync_phages, beside the roster and before the pages that are drawn from it", () => {
  assert.deepEqual(repairPlan(["phage-drift"], WITH).repair, ["sync_phages"]);

  const all = repairPlan(["ask-index-drift", "pages-drift", "phage-drift", "roster-drift", "dictionary-drift", "content-drift"], WITH);
  assert.deepEqual(all.repair, ["sync_posts", "sync_dictionary", "sync_roster", "sync_phages", "sync_pages", "sync_ask"]);
  assert.equal(all.alertOnly, false);

  const actions = watchdogActions({ status: 503, body: bodyFailing(["phage-drift"]) }, WITH);
  assert.deepEqual(actions, [{ type: "repair", tool: "sync_phages" }, { type: "recheck" }]);
});

test("roster drift repairs through sync_roster, beside the dictionary and before the pages", () => {
  assert.deepEqual(repairPlan(["roster-drift"], WITH).repair, ["sync_roster"]);

  const all = repairPlan(["ask-index-drift", "pages-drift", "roster-drift", "dictionary-drift", "content-drift"], WITH);
  assert.deepEqual(all.repair, ["sync_posts", "sync_dictionary", "sync_roster", "sync_pages", "sync_ask"]);
  assert.equal(all.alertOnly, false);

  const actions = watchdogActions({ status: 503, body: bodyFailing(["roster-drift"]) }, WITH);
  assert.deepEqual(actions, [{ type: "repair", tool: "sync_roster" }, { type: "recheck" }]);
});

test("CV PDF drift repairs through sync_cv_pdf, after the CV rows it is drawn from and before the Ask upload", () => {
  assert.deepEqual(repairPlan(["cv-pdf-drift"], WITH).repair, ["sync_cv_pdf"]);

  const all = repairPlan(["ask-index-drift", "cv-pdf-drift", "cv-drift", "content-drift"], WITH);
  assert.deepEqual(all.repair, ["sync_posts", "sync_cv", "sync_cv_pdf", "sync_ask"]);
  assert.equal(all.alertOnly, false);

  const actions = watchdogActions({ status: 503, body: bodyFailing(["cv-pdf-drift"]) }, WITH);
  assert.deepEqual(actions, [{ type: "repair", tool: "sync_cv_pdf" }, { type: "recheck" }]);
});
