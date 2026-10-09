import test from "node:test";
import assert from "node:assert/strict";

import {
  RUN_VERSION,
  clock,
  finishRun,
  newRun,
  parseRun,
  pauseTimer,
  resetTimer,
  runMarkdown,
  runProgress,
  runRecord,
  setNote,
  setRunNote,
  setScale,
  startTimer,
  tickTimers,
  timerKey,
  timerMs,
  timerRemaining,
  toggleDone,
} from "../app/kb/procedures/run.mjs";

/* Run mode's pure half (app/kb/procedures/run.mjs): what a bench run is, how its timers count, and what the saved
 * record says. No clock, storage or DOM is read, so each case passes `now` in. */

const T0 = Date.UTC(2026, 9, 3, 15, 0, 0);
const procedure = { path: "/research/protocols/phage-dna-extraction", version: "3", title: "Phage DNA Extraction Protocol", scale: 5 };
// Numbering restarts in a section that starts its own list, so a step is found by its key, not its number: the
// second "step 1" here is a different step from the first.
const STEPS = [
  { key: "part-a.1", number: 1, section: "Part A", text: "Add 20 µl ZnCl2 to each tube. Incubate for 5 minutes." },
  { key: "part-a.2", number: 2, section: "Part A", text: "Spin 1 minute.\n   Remove the supernatant." },
  { key: "part-b.1", number: 1, section: "Part B", text: "Dry the pellet." },
];
const KEYS = STEPS.map((s) => s.key);

test("timerMs: the longer end of a range, in the mark's own unit, so a timer never rings early", () => {
  assert.equal(timerMs({ label: "", text: "5 minutes", min: 5, max: 5, unit: "minutes" }), 300_000);
  assert.equal(timerMs({ label: "", text: "5 to 10 minutes", min: 5, max: 10, unit: "minutes" }), 600_000);
  assert.equal(timerMs({ label: "", text: "30 sec.", min: 30, max: null, unit: "sec" }), 30_000);
  assert.equal(timerMs({ label: "", text: "2 hours", min: 2, max: 2, unit: "hours" }), 7_200_000);
  assert.equal(timerMs({ label: "", text: "1 day", min: 1, max: 1, unit: "day" }), 86_400_000);
  assert.equal(timerMs({ label: "", text: "x", min: null, max: null, unit: "minutes" }), null);
  assert.equal(timerMs({ label: "", text: "0 minutes", min: 0, max: 0, unit: "minutes" }), null);
  assert.equal(timerMs({ label: "", text: "5 furlongs", min: 5, max: 5, unit: "furlongs" }), null);
});

test("steps: a check records when it was done and unchecks cleanly; notes are kept and bounded", () => {
  let run = newRun(procedure, T0);
  assert.deepEqual([run.v, run.path, run.version, run.scale, run.finishedAt], [RUN_VERSION, procedure.path, "3", 5, null]);
  run = toggleDone(run, 1, T0 + 1000);
  assert.deepEqual(run.steps["1"], { done: true, doneAt: T0 + 1000, note: "" });
  run = setNote(run, 1, "tube 3 was cloudy");
  assert.equal(run.steps["1"].note, "tube 3 was cloudy");
  assert.equal(run.steps["1"].done, true, "a note does not undo the check");
  run = toggleDone(run, 1, T0 + 2000);
  assert.deepEqual(run.steps["1"], { done: false, doneAt: null, note: "tube 3 was cloudy" });
  assert.equal(setNote(newRun(procedure, T0), 2, "x".repeat(5000)).steps["2"].note.length, 2000);
  assert.equal(setRunNote(newRun(procedure, T0), "y".repeat(9000)).note.length, 4000);
  assert.equal(setScale(newRun(procedure, T0), 8).scale, 8);
});

test("run functions never change the run they are given", () => {
  const run = newRun(procedure, T0);
  const frozen = JSON.stringify(run);
  toggleDone(run, 1, T0);
  setNote(run, 1, "n");
  startTimer(run, "1.0", 1000, T0);
  finishRun(run, T0);
  assert.equal(JSON.stringify(run), frozen);
});

test("a timer counts to the moment it ends, so a reload or a sleeping phone still knows what is left", () => {
  const key = timerKey(1, 0);
  assert.equal(key, "1.0");
  let run = startTimer(newRun(procedure, T0), key, 300_000, T0);
  assert.equal(timerRemaining(run, key, T0), 300_000);
  assert.equal(timerRemaining(run, key, T0 + 120_000), 180_000, "two minutes in, three left");
  assert.equal(timerRemaining(run, key, T0 + 999_000), 0, "never negative");
  assert.equal(timerRemaining(run, "9.9", T0), null, "an unstarted timer has no remaining time");
  // The record written to storage and read back after a long gap still answers.
  const restored = parseRun(JSON.stringify(run));
  assert.equal(timerRemaining(restored, key, T0 + 240_000), 60_000);
});

test("pause keeps what is left and resume continues from there", () => {
  const key = "1.0";
  let run = startTimer(newRun(procedure, T0), key, 300_000, T0);
  run = pauseTimer(run, key, T0 + 100_000);
  assert.equal(run.timers[key].state, "paused");
  assert.equal(timerRemaining(run, key, T0 + 900_000), 200_000, "a paused timer does not run down");
  run = startTimer(run, key, 300_000, T0 + 1_000_000);
  assert.equal(run.timers[key].state, "running");
  assert.equal(timerRemaining(run, key, T0 + 1_050_000), 150_000, "resumed with 200 s left, 50 s later 150 s");
  assert.equal(pauseTimer(newRun(procedure, T0), "x", T0).timers.x, undefined, "pausing an unstarted timer does nothing");
  assert.equal(Object.keys(resetTimer(run, key).timers).length, 0, "reset forgets the timer");
});

test("tickTimers: a timer whose time has come is done once, and reported once", () => {
  let run = startTimer(newRun(procedure, T0), "1.0", 60_000, T0);
  run = startTimer(run, "2.0", 600_000, T0);
  const early = tickTimers(run, T0 + 30_000);
  assert.deepEqual(early.rang, []);
  assert.equal(early.run, run, "nothing changed, so the same run comes back");
  const later = tickTimers(run, T0 + 61_000);
  assert.deepEqual(later.rang, ["1.0"]);
  assert.equal(later.run.timers["1.0"].state, "done");
  assert.equal(later.run.timers["2.0"].state, "running");
  assert.deepEqual(tickTimers(later.run, T0 + 90_000).rang, [], "a done timer does not ring again");
  assert.equal(timerRemaining(later.run, "1.0", T0 + 90_000), 0);
});

test("clock: minutes and seconds, hours when there are any, rounding up so 0:00 means done", () => {
  assert.equal(clock(125_000), "2:05");
  assert.equal(clock(5_400_000), "1:30:00");
  assert.equal(clock(999), "0:01");
  assert.equal(clock(0), "0:00");
  assert.equal(clock(-5), "0:00");
});

test("progress counts the steps the procedure has, not the steps the run mentions", () => {
  let run = newRun(procedure, T0);
  run = toggleDone(toggleDone(run, "part-a.1", T0), "part-b.1", T0);
  assert.deepEqual(runProgress(run, KEYS), { done: 2, total: 3 });
  assert.deepEqual(runProgress(toggleDone(run, "nowhere.99", T0), KEYS), { done: 2, total: 3 }, "a stray step is not counted");
});

test("the record names the procedure and its version, and holds only what the person did and wrote", () => {
  let run = newRun(procedure, T0);
  run = toggleDone(run, "part-a.1", T0 + 60_000);
  run = setNote(run, "part-a.2", "centrifuge 2 was out");
  run = setRunNote(run, "second prep of the day");
  run = finishRun(run, T0 + 3_600_000);
  const rec = runRecord(run, STEPS);
  assert.equal(rec.record, "dustinedwards.info run");
  assert.deepEqual(rec.procedure, { path: procedure.path, title: procedure.title, version: "3" });
  assert.equal(rec.scale, 5);
  assert.equal(rec.startedAt, "2026-10-03T15:00:00.000Z");
  assert.equal(rec.finishedAt, "2026-10-03T16:00:00.000Z");
  assert.deepEqual(rec.steps[0], { step: 1, section: "Part A", text: STEPS[0].text, done: true, doneAt: "2026-10-03T15:01:00.000Z", note: "" });
  assert.deepEqual(rec.steps[1], { step: 2, section: "Part A", text: STEPS[1].text, done: false, doneAt: "", note: "centrifuge 2 was out" });
  assert.deepEqual(rec.steps[2], { step: 1, section: "Part B", text: STEPS[2].text, done: false, doneAt: "", note: "" }, "the second step 1 is its own step");
  assert.equal(finishRun(run, T0 + 9_999_999).finishedAt, T0 + 3_600_000, "finishing twice keeps the first time");
});

test("the Markdown record is plain, with checked lines and notes under their steps", () => {
  let run = newRun(procedure, T0);
  run = toggleDone(run, "part-a.1", T0 + 60_000);
  run = setNote(run, "part-a.2", "line one\nline two");
  const md = runMarkdown(run, STEPS);
  assert.match(md, /^# Run: Phage DNA Extraction Protocol\n/);
  assert.match(md, /Protocol: \/research\/protocols\/phage-dna-extraction, version 3\n/);
  assert.match(md, /Scale: 5\n/);
  assert.match(md, /- \[x\] 1\. Add 20 µl ZnCl2 to each tube\. Incubate for 5 minutes\. \(2026-10-03T15:01:00\.000Z\)\n/);
  assert.match(md, /- \[ \] 2\. Spin 1 minute\. Remove the supernatant\.\n  - Note: line one line two\n/);
  assert.match(md, /### Part A\n/);
  assert.match(md, /### Part B\n\n- \[ \] 1\. Dry the pellet\.\n/, "a second list restarts its numbering under its own heading");
  assert.doesNotMatch(md, /Finished:/, "a run still going has no finish time");
  assert.ok(md.endsWith("\n") && !md.endsWith("\n\n"));
});

test("parseRun accepts only what this module wrote and ignores everything else", () => {
  const run = toggleDone(newRun(procedure, T0), 1, T0);
  assert.deepEqual(parseRun(JSON.stringify(run)), run);
  assert.equal(parseRun(null), null);
  assert.equal(parseRun("not json"), null);
  assert.equal(parseRun(JSON.stringify({ ...run, v: 99 })), null, "another format");
  assert.equal(parseRun(JSON.stringify({ ...run, steps: null })), null);
  assert.equal(parseRun(JSON.stringify({ v: RUN_VERSION })), null);
  const tidy = parseRun(JSON.stringify({ ...run, title: 5, scale: "x", version: 3, finishedAt: "no", note: 7 }));
  assert.deepEqual([tidy.title, tidy.scale, tidy.version, tidy.finishedAt, tidy.note], ["", null, "", null, ""], "a wrong-typed field falls back, it is never trusted");
});

test("two steps that share a number are two steps: checking one leaves the other, in progress and in the record", () => {
  let run = newRun(procedure, T0);
  run = toggleDone(run, "part-a.1", T0 + 1000);
  assert.equal(run.steps["part-b.1"], undefined);
  assert.deepEqual(runProgress(run, KEYS), { done: 1, total: 3 });
  const rec = runRecord(run, STEPS);
  assert.deepEqual(rec.steps.map((s) => [s.section, s.step, s.done]), [["Part A", 1, true], ["Part A", 2, false], ["Part B", 1, false]]);
  run = toggleDone(run, "part-b.1", T0 + 2000);
  assert.deepEqual(runProgress(run, KEYS), { done: 2, total: 3 });
});
