import test from "node:test";
import assert from "node:assert/strict";

import {
  DESCRIPTION_MAX,
  TITLE_MAX,
  TITLE_SIZES,
  cardDescription,
  cardTitle,
  clampWords,
  titleFontSize,
} from "../app/lib/content/og-card-text.mjs";

/**
 * Short words, so character count tracks rendered width the way the ladder was measured.
 * @param {number} n
 */
function titleOfLength(n) {
  const word = "abcd ";
  return word.repeat(Math.ceil(n / word.length)).slice(0, n).trimEnd().padEnd(n, "z");
}

test("THE SIZE DROPS ONE CHARACTER PAST EVERY BREAKPOINT", () => {
  for (let i = 0; i < TITLE_SIZES.length - 1; i += 1) {
    const rung = TITLE_SIZES[i];
    const next = TITLE_SIZES[i + 1];

    assert.equal(
      titleFontSize(titleOfLength(rung.maxChars)),
      rung.fontSize,
      `${rung.maxChars} characters must still take ${rung.fontSize}px`,
    );
    assert.equal(
      titleFontSize(titleOfLength(rung.maxChars + 1)),
      next.fontSize,
      `${rung.maxChars + 1} characters must drop to ${next.fontSize}px`,
    );
    assert.ok(
      next.fontSize < rung.fontSize,
      `rung ${i + 1} must be SMALLER than rung ${i}, not ${next.fontSize} against ${rung.fontSize}`,
    );
  }
});

test("a longer title never takes larger type, and a drawn title always has a size", () => {
  let previous = Infinity;
  for (let n = 0; n <= TITLE_MAX + 100; n += 1) {
    const size = titleFontSize(cardTitle(titleOfLength(n)));
    assert.ok(size <= previous, `${n} characters took ${size}px after ${previous}px`);
    previous = size;
  }
});

test("the shortest titles take the largest size", () => {
  assert.equal(titleFontSize("Hi"), TITLE_SIZES[0].fontSize);
  assert.equal(titleFontSize(""), TITLE_SIZES[0].fontSize);
});

test("PAST THE LADDER IT THROWS, and does not substitute a size", () => {
  assert.throws(
    () => titleFontSize(titleOfLength(TITLE_MAX + 1)),
    /past the last rung/,
    "an over-long title must be an error, never a quiet fallback",
  );
});

test("a title inside the cap is returned untouched", () => {
  const title = "Where should a blog store its words?";
  assert.equal(cardTitle(title), title);
  assert.doesNotMatch(cardTitle(title), /…/, "nothing short may be marked as cut");
});

test("an over-long title is cut on a WORD boundary and marked", () => {
  const cut = cardTitle(titleOfLength(TITLE_MAX + 40));
  assert.ok(cut.length <= TITLE_MAX + 1, `cut to ${cut.length}, cap is ${TITLE_MAX}`);
  assert.match(cut, /…$/, "a cut must be visible to the reader");
  assert.doesNotMatch(
    cut.slice(0, -1),
    / $/,
    "the space before the ellipsis belongs to the word boundary, not to the output",
  );
});

test("the cut lands on a real boundary, never inside a word", () => {
  const text = "one two three four five six seven eight boundary";
  const cut = clampWords(text, 44);
  assert.equal(cut, "one two three four five six seven eight…");
});

test("a single unbreakable word longer than the cap is cut anyway", () => {
  // satori has no word-break to fall back on, so the alternative is running off the card.
  const cut = clampWords("z".repeat(60), 20);
  assert.equal(cut, `${"z".repeat(20)}…`);
});

test("dangling punctuation is dropped before the ellipsis", () => {
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

test("the em dash and the en dash are dropped too, and neither is in the source", () => {
  // The module spells these dashes as escapes because the repo refuses the raw bytes, and a
  // mistyped escape would let the dash survive into the card.
  const emDash = String.fromCharCode(0x2014);
  const enDash = String.fromCharCode(0x2013);
  assert.equal(clampWords(`alpha beta${emDash} gamma`, 14), "alpha beta…");
  assert.equal(clampWords(`alpha beta${enDash} gamma`, 14), "alpha beta…");
});

test("the description is cut at its own cap, not the title's", () => {
  const long = titleOfLength(400);
  const cut = cardDescription(long);
  assert.ok(cut.length <= DESCRIPTION_MAX + 1, `cut to ${cut.length}, cap is ${DESCRIPTION_MAX}`);
  assert.match(cut, /…$/);
  assert.ok(
    DESCRIPTION_MAX < TITLE_MAX,
    "the description is two lines of smaller type and must be the tighter cap",
  );
});

test("an absent description is the empty string, never the word null", () => {
  for (const missing of [null, undefined, "", "   "]) {
    assert.equal(cardDescription(missing), "");
  }
});

test("surrounding whitespace is not counted against the cap", () => {
  const padded = `   ${"a".repeat(DESCRIPTION_MAX)}   `;
  assert.equal(cardDescription(padded), "a".repeat(DESCRIPTION_MAX));
});
