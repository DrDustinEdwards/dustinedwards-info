import test from "node:test";
import assert from "node:assert/strict";

import { FOLLOW_UP_MARKER, splitFollowUp } from "../app/lib/search/follow-up.mjs";
import { FOLLOW_UP_INSTRUCTION, SYSTEM_PROMPT } from "../app/lib/search/ask-prompt.mjs";
import { builtIslandFiles } from "../scripts/lib/islands.mjs";

await test("an answer with a follow-up splits into both", () => {
  assert.deepEqual(splitFollowUp("The answer.\nNEXT: What else is here?"), {
    answer: "The answer.",
    followUp: "What else is here?",
  });
});

await test("no marker is the normal case and returns the answer untouched", () => {
  const raw = "An answer with no follow up at all.";
  assert.deepEqual(splitFollowUp(raw), { answer: raw, followUp: null });
});

await test("a marker with nothing after it is not a question", () => {
  assert.deepEqual(splitFollowUp("The answer.\nNEXT:"), {
    answer: "The answer.",
    followUp: null,
  });
});

await test("a mid-sentence marker is prose and does NOT truncate the answer", () => {
  const raw = "The NEXT: release is covered here.";
  assert.deepEqual(
    splitFollowUp(raw),
    { answer: raw, followUp: null },
    "splitting here would cut the answer in half",
  );
});

await test("the last marker wins, so an earlier mention cannot steal the split", () => {
  const raw = "A line about NEXT: things.\nMore answer.\nNEXT: The real one?";
  const out = splitFollowUp(raw);
  assert.equal(out.followUp, "The real one?");
  assert.match(out.answer, /More answer\.$/);
});

await test("an answer written the way the prompt asks splits into the right follow-up", () => {
  assert.ok(SYSTEM_PROMPT.includes(FOLLOW_UP_INSTRUCTION), "the model must be sent the instruction");
  // The prefix the model is told to write, read off the instruction rather than the splitter.
  const prefix = FOLLOW_UP_INSTRUCTION.trim().split(/\s+/).at(-1);
  const raw = `Phages are viruses that infect bacteria.\n${prefix} How are phages found?`;
  assert.deepEqual(splitFollowUp(raw), {
    answer: "Phages are viruses that infect bacteria.",
    followUp: "How are phages found?",
  });
});

// Reads the built artifact: the import that leaked the prompt was correct-looking source. Built here
// by the app build's own islands plugin, so the bytes are the ones the page is served: the ask island,
// and every other file the build emits beside it, since a shared chunk could carry it too.
await test("the built client bundle carries NO system prompt text", async () => {
  const files = await builtIslandFiles();
  const built = files.map((file) => String(file.source)).join("\n");
  const ask = files.find((file) => /^islands\/ask-[\w-]+\.js$/.test(file.fileName));
  assert.ok(ask, `no ask island among ${files.map((file) => file.fileName).join(", ")}`);

  /* The needle is the prompt itself, so it cannot drift from what is actually secret. */
  const firstSentence = SYSTEM_PROMPT.split(". ")[0];
  assert.ok(firstSentence.length > 30, "the needle must be a real sentence, not a fragment");
  assert.ok(
    !built.includes(firstSentence),
    "the system prompt is in the client bundle: a reader can read the instructions, and " +
      "answerLeaksPrompt is guarding a door that is already open",
  );

  assert.ok(
    String(ask?.source).includes(FOLLOW_UP_MARKER),
    "the marker is absent too, so this test is reading the wrong file or an empty one",
  );
});
