/* Every failure mode here still produces a URL that works and highlights nothing, which looks
 * like an unsupported browser, so the assertions are on the STRING. */

import test from "node:test";
import assert from "node:assert/strict";

import {
  FRAGMENT_EDGE_WORDS,
  FRAGMENT_MAX_CHARS,
  FRAGMENT_MIN_CHARS,
  textFragment,
} from "../app/lib/text-fragment.mjs";

/** A word per index, so a range form's two ends are identifiable rather than just long. */
const longPassage = Array.from({ length: 60 }, (_, index) => `word${index}`).join(" ");

test("a short selection is refused rather than encoded", () => {
  assert.equal(textFragment("too short"), null);
  assert.equal(textFragment("   "), null);
  assert.equal(textFragment(""), null);
  const atFloor = "x".repeat(FRAGMENT_MIN_CHARS);
  assert.equal(textFragment(atFloor), atFloor);
});

test("an ordinary passage takes the exact form", () => {
  assert.equal(textFragment("a sentence worth linking to"), "a%20sentence%20worth%20linking%20to");
});

test("the three reserved characters are all escaped", () => {
  /* The hyphen is the one `encodeURIComponent` leaves behind, and it changes what the
   * directive MEANS: `a-,b` is a prefix match. */
  assert.equal(textFragment("first-class, and cheap & fast"), "first%2Dclass%2C%20and%20cheap%20%26%20fast");
  assert.ok(!textFragment("first-class, and cheap & fast").includes("-"));
});

test("a passage over the ceiling becomes a start,end range", () => {
  assert.ok(longPassage.length > FRAGMENT_MAX_CHARS);
  const fragment = textFragment(longPassage);
  const [start, end] = fragment.split(",");
  assert.equal(start, encodeURIComponent(`word0 word1 word2 word3 word4 word5`));
  assert.equal(end, encodeURIComponent(`word54 word55 word56 word57 word58 word59`));
  assert.equal(start.split("%20").length, FRAGMENT_EDGE_WORDS);
});

test("a selection crossing a block takes the range form however short it is", () => {
  /* Well under the ceiling, so a length test alone would emit the exact form, which can never
   * match: the directive is matched within one block and this text spans two. */
  const crossing = "the end of one paragraph\nthe start of the next";
  assert.ok(crossing.length < FRAGMENT_MAX_CHARS);
  const fragment = textFragment(crossing);
  assert.equal(fragment, "the%20end%20of%20one%20paragraph,the%20start%20of%20the%20next");
  assert.ok(!textFragment(crossing.replace("\n", " ")).includes(","));
});

test("runs of spaces and tabs collapse, and newlines survive to be detected", () => {
  assert.equal(textFragment("spaced   out \t words"), "spaced%20out%20words");
  assert.ok(textFragment("a line of text\nand another line").includes(","));
});

test("a two-word selection across a block does not fold into a degenerate range", () => {
  /* One word each side is still two distinct ends; a single word would give `start,start`. */
  const fragment = textFragment("paragraphing\nsentences");
  assert.equal(fragment, "paragraphing,sentences");
  assert.notEqual(fragment.split(",")[0], fragment.split(",")[1]);
});
