/**
 * The social card's fitted type, as a pure function rather than as a picture.
 *
 * REPLAYS THE DEFECT, per the replay rule. The previous template drew every title
 * at ONE size and cut at ONE length, so the only thing standing between a long
 * headline and the foot of the card was the corpus happening to be short. The
 * cut itself had already been a defect of exactly this shape: the title and the
 * description carried `WebkitLineClamp`, which satori ignores, so a clamp that
 * rendered byte-identical with and without it was believed for two templates.
 *
 * What is asserted here is the property a picture cannot show: that the size
 * DROPS at the boundary. A rendered card proves one title looked fine. This
 * proves the ladder is a ladder.
 *
 * @see app/lib/content/og-card-text.mjs
 */

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
 * A title of exactly `n` characters made of short words, so the character count
 * and the rendered width stay in the relationship the ladder was measured in.
 * A single run of `x` would be one unbreakable word, which is the case the
 * module's own docblock names as the one characters cannot model.
 *
 * @param {number} n
 */
function titleOfLength(n) {
  const word = "abcd ";
  return word.repeat(Math.ceil(n / word.length)).slice(0, n).trimEnd().padEnd(n, "z");
}

test("the fixture builds titles of exactly the length asked for", () => {
  // The instrument before the measurement. Every boundary test below is
  // meaningless if this is off by one, and off by one is precisely what a
  // boundary test is looking for.
  for (const n of [1, 5, 71, 72, 73, 110, 111, 150]) {
    assert.equal(titleOfLength(n).length, n, `titleOfLength(${n})`);
  }
});

test("THE SIZE DROPS ONE CHARACTER PAST EVERY BREAKPOINT", () => {
  // The plant, run as a test rather than by hand: feed each rung its exact
  // bound, then one character more, and assert the size went DOWN. A ladder
  // whose rungs were mis-ordered, or whose comparison was `<` where it should
  // be `<=`, fails here and nowhere else.
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

test("the ladder is ordered, so the first match is the right match", () => {
  // `titleFontSize` returns the FIRST rung whose bound the title fits inside.
  // That is only correct while the bounds ascend. A table sorted the other way
  // would return the smallest type for every title and never throw.
  for (let i = 1; i < TITLE_SIZES.length; i += 1) {
    assert.ok(
      TITLE_SIZES[i].maxChars > TITLE_SIZES[i - 1].maxChars,
      "maxChars must ascend down the ladder",
    );
  }
  assert.equal(
    TITLE_SIZES[TITLE_SIZES.length - 1].maxChars,
    TITLE_MAX,
    "the last rung must be bounded by TITLE_MAX, or a clamped title can still fall off the end",
  );
});

test("the shortest titles take the largest size", () => {
  assert.equal(titleFontSize("Hi"), TITLE_SIZES[0].fontSize);
  assert.equal(titleFontSize(""), TITLE_SIZES[0].fontSize);
});

test("PAST THE LADDER IT THROWS, and does not substitute a size", () => {
  // The no-substitution rule. A `?? smallest` here would mean an unclamped title rendered
  // at a size nobody chose, silently, which is the failure mode the whole
  // module exists to remove.
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
  // The word being cut is "boundary". Anything ending in a fragment of it,
  // "boun" or "bound", is the mid-word cut this is here to refuse.
  const text = "one two three four five six seven eight boundary";
  const cut = clampWords(text, 44);
  assert.equal(cut, "one two three four five six seven eight…");
});

test("a single unbreakable word longer than the cap is cut anyway", () => {
  // There is no boundary to find. Running off the edge of the card is worse
  // than an abbreviation, and satori has no word-break to fall back on.
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
  // The module builds its character class from `\u` escapes because this repo
  // refuses those bytes anywhere, hook-enforced. That spelling is easy to get
  // wrong in a way nothing else would notice: a mistyped escape makes the class
  // match something else entirely and the dash survives into the card.
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
  // The template renders whatever comes back. `String(null)` on a card is the
  // "Invalid Date" defect wearing different clothes.
  for (const missing of [null, undefined, "", "   "]) {
    assert.equal(cardDescription(missing), "");
  }
});

test("surrounding whitespace is not counted against the cap", () => {
  const padded = `   ${"a".repeat(DESCRIPTION_MAX)}   `;
  assert.equal(cardDescription(padded), "a".repeat(DESCRIPTION_MAX));
});
