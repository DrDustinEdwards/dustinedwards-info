import test from "node:test";
import assert from "node:assert/strict";

import {
  DESCRIPTION_MAX,
  TITLE_MAX,
  cardDescription,
  cardTitle,
  clampWords,
} from "../app/lib/content/og-card-text.mjs";

/**
 * Short words, so character count tracks rendered width the way the ladder was measured.
 * @param {number} n
 */
function titleOfLength(n) {
  const word = "abcd ";
  return word
    .repeat(Math.ceil(n / word.length))
    .slice(0, n)
    .trimEnd()
    .padEnd(n, "z");
}

await test("a title inside the cap is returned untouched", () => {
  const title = "Where should a blog store its words?";
  assert.equal(cardTitle(title), title);
  assert.doesNotMatch(cardTitle(title), /…/, "nothing short may be marked as cut");
});

await test("an over-long title is cut on a WORD boundary and marked", () => {
  const cut = cardTitle(titleOfLength(TITLE_MAX + 40));
  assert.ok(cut.length <= TITLE_MAX + 1, `cut to ${cut.length}, cap is ${TITLE_MAX}`);
  assert.match(cut, /…$/, "a cut must be visible to the reader");
  assert.doesNotMatch(
    cut.slice(0, -1),
    / $/,
    "the space before the ellipsis belongs to the word boundary, not to the output",
  );
});

await test("the cut lands on a real boundary, never inside a word", () => {
  const text = "one two three four five six seven eight boundary";
  const cut = clampWords(text, 44);
  assert.equal(cut, "one two three four five six seven eight…");
});

await test("a single unbreakable word longer than the cap is cut anyway", () => {
  // satori has no word-break to fall back on, so the alternative is running off the card.
  const cut = clampWords("z".repeat(60), 20);
  assert.equal(cut, `${"z".repeat(20)}…`);
});

await test("dangling punctuation is dropped before the ellipsis", () => {
  for (const [text, expected] of [
    ["alpha beta, gamma", "alpha beta…"],
    ["alpha beta; gamma", "alpha beta…"],
    ["alpha beta: gamma", "alpha beta…"],
    ["alpha beta. gamma", "alpha beta…"],
    ["alpha beta-- gamma", "alpha beta…"],
  ]) {
    assert.equal(clampWords(text, 13), expected, text);
  }
});

await test("the em dash and the en dash are dropped too, and neither is in the source", () => {
  // The module spells these dashes as escapes because the repo refuses the raw bytes, and a
  // mistyped escape would let the dash survive into the card.
  const emDash = String.fromCharCode(0x2014);
  const enDash = String.fromCharCode(0x2013);
  assert.equal(clampWords(`alpha beta${emDash} gamma`, 14), "alpha beta…");
  assert.equal(clampWords(`alpha beta${enDash} gamma`, 14), "alpha beta…");
});

await test("the description is cut at its own cap, not the title's", () => {
  const long = titleOfLength(400);
  const cut = cardDescription(long);
  assert.ok(cut.length <= DESCRIPTION_MAX + 1, `cut to ${cut.length}, cap is ${DESCRIPTION_MAX}`);
  assert.match(cut, /…$/);
  assert.ok(
    DESCRIPTION_MAX < TITLE_MAX,
    "the description is two lines of smaller type and must be the tighter cap",
  );
});

await test("an absent description is the empty string, never the word null", () => {
  for (const missing of [null, undefined, "", "   "]) {
    assert.equal(cardDescription(missing), "");
  }
});

await test("surrounding whitespace is not counted against the cap", () => {
  const padded = `   ${"a".repeat(DESCRIPTION_MAX)}   `;
  assert.equal(cardDescription(padded), "a".repeat(DESCRIPTION_MAX));
});
