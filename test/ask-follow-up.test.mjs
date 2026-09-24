/**
 * The Ask follow-up: where it is split off, and what must never travel with it.
 *
 * REPLAYS A DEFECT THIS BRANCH CREATED AND CAUGHT, per the replay rule. The splitter first lived in
 * `ask-prompt.mjs`, which is where it reads as belonging. `app/enhance/ask.ts` imported it from
 * there, and the built client bundle then carried `SYSTEM_PROMPT` into every reader's browser.
 * Tree-shaking did not remove it; a grep of the built artifact is what said so.
 *
 * That is not a page-weight problem. `answerLeaksPrompt` exists to catch the MODEL repeating its
 * instructions, and publishing those instructions as a static asset makes the guard moot. The last
 * test here is the one that matters: it reads the BUILT bundle, because the defect was invisible
 * in the source and visible only in the artifact.
 *
 * @see app/lib/search/follow-up.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { FOLLOW_UP_MARKER, splitFollowUp } from "../app/lib/search/follow-up.mjs";
import { FOLLOW_UP_INSTRUCTION, SYSTEM_PROMPT } from "../app/lib/search/ask-prompt.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("an answer with a follow-up splits into both", () => {
  assert.deepEqual(splitFollowUp("The answer.\nNEXT: What else is here?"), {
    answer: "The answer.",
    followUp: "What else is here?",
  });
});

test("no marker is the normal case and returns the answer untouched", () => {
  const raw = "An answer with no follow up at all.";
  assert.deepEqual(splitFollowUp(raw), { answer: raw, followUp: null });
});

test("a marker with nothing after it is not a question", () => {
  assert.deepEqual(splitFollowUp("The answer.\nNEXT:"), {
    answer: "The answer.",
    followUp: null,
  });
});

test("a mid-sentence marker is prose and does NOT truncate the answer", () => {
  const raw = "The NEXT: release is covered here.";
  assert.deepEqual(
    splitFollowUp(raw),
    { answer: raw, followUp: null },
    "splitting here would cut the answer in half",
  );
});

test("the last marker wins, so an earlier mention cannot steal the split", () => {
  const raw = "A line about NEXT: things.\nMore answer.\nNEXT: The real one?";
  const out = splitFollowUp(raw);
  assert.equal(out.followUp, "The real one?");
  assert.match(out.answer, /More answer\.$/);
});

test("an answer written the way the prompt asks splits into the right follow-up", () => {
  assert.ok(SYSTEM_PROMPT.includes(FOLLOW_UP_INSTRUCTION), "the model must be sent the instruction");
  // The prefix the model is told to write, read off the instruction rather than the splitter.
  const prefix = FOLLOW_UP_INSTRUCTION.trim().split(/\s+/).at(-1);
  const raw = `Phages are viruses that infect bacteria.\n${prefix} How are phages found?`;
  assert.deepEqual(splitFollowUp(raw), {
    answer: "Phages are viruses that infect bacteria.",
    followUp: "How are phages found?",
  });
});

/*
 * THE ONE THAT CAUGHT THE DEFECT. It reads the built artifact, not the source: the import that
 * leaked the prompt was correct-looking TypeScript and only the bundle showed it.
 */
test("the built client bundle carries NO system prompt text", () => {
  const bundle = join(root, "app/enhance/dist/ask.js");
  /* Scope first: an absent bundle would pass this by having nothing to find. */
  assert.ok(existsSync(bundle), "run build:enhance before this test can measure anything");
  const built = readFileSync(bundle, "utf8");

  /* The needle is the prompt itself, so it cannot drift from what is actually secret. */
  const firstSentence = SYSTEM_PROMPT.split(". ")[0];
  assert.ok(firstSentence.length > 30, "the needle must be a real sentence, not a fragment");
  assert.ok(
    !built.includes(firstSentence),
    "the system prompt is in the client bundle: a reader can read the instructions, and " +
      "answerLeaksPrompt is guarding a door that is already open",
  );

  /* The control: the marker IS expected there, so a bundle this test cannot read would fail. */
  assert.ok(
    built.includes(FOLLOW_UP_MARKER),
    "the marker is absent too, so this test is reading the wrong file or an empty one",
  );
});
