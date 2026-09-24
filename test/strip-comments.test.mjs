/**
 * The shared JS-scan comment stripper, and the boundary it must not cross.
 *
 * Nine gates carried their own copy of one job. The risk consolidation removes
 * is DRIFT IN STRENGTH: a copy weaker than its siblings does not fail, it
 * passes for a reason nobody checks. The old logo gate's copy was exactly
 * that, and a plant there proved it.
 *
 * THE BOUNDARY IS ASSERTED HERE RATHER THAN DESCRIBED. The reconciliation ruled
 * this helper must never be fed JSONC or SVG. A comment saying so is a claim
 * that ages, per the live-path rule; the tests below FEED it those and assert the
 * damage, so the day someone points it at wrangler.jsonc the reason is already
 * written as an executable fact.
 *
 * @see scripts/lib/strip-comments.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import { stripComments, stripCommentsAndStrings } from "../scripts/lib/strip-comments.mjs";

/* ------------------------------------------------------------ the job it does */

test("block and line comments go", () => {
  assert.equal(stripComments("const a = 1; // note").trim(), "const a = 1;");
  assert.equal(stripComments("const /* mid */ a = 1;").includes("mid"), false);
});

test("THE COLON GUARD: a url in a string is not a comment", () => {
  // The reason this helper can be pointed at TypeScript full of links.
  const src = 'const docs = "https://developers.cloudflare.com/workers/";';
  assert.equal(stripComments(src).includes("developers.cloudflare.com"), true);
});

test("a comment naming a forbidden literal cannot satisfy a scan", () => {
  // The trap every gate here has hit: prose explaining why a value is wrong
  // contains that value.
  const src = ['// never write "same-origin" here', 'const policy = "cross-origin";'].join("\n");
  const code = stripComments(src);
  assert.equal(code.includes("same-origin"), false, "the prose must not survive");
  assert.equal(code.includes("cross-origin"), true, "the code must");
});

test("preserveLines keeps the line count, so reported lines do not shift", () => {
  const src = ["const a = 1;", "/* one", "   two", "   three */", "const b = 2;"].join("\n");
  const collapsed = stripComments(src);
  const preserved = stripComments(src, { preserveLines: true });
  assert.equal(preserved.split("\n").length, src.split("\n").length);
  assert.notEqual(collapsed.split("\n").length, src.split("\n").length, "the default does collapse");
  assert.equal(preserved.includes("two"), false, "still actually stripped");
});

test("stripCommentsAndStrings blanks literals but keeps the code around them", () => {
  const src = 'const token = "GITHUB_TOKEN"; // the name appears in prose too';
  const out = stripCommentsAndStrings(src);
  assert.equal(out.includes("GITHUB_TOKEN"), false, "the literal must be blanked");
  assert.equal(out.includes("const token"), true, "the declaration must survive");
});

test("comments are stripped BEFORE strings, or an apostrophe eats the file", () => {
  // check:invariants section 5 reported process.argv and Math.floor as unknown
  // database columns because a docblock apostrophe opened a string literal that
  // ran on until the next apostrophe in the file.
  const src = ["/* the editor's own copy */", "const real = process.argv;", "// doesn't matter"].join("\n");
  const out = stripCommentsAndStrings(src);
  assert.equal(out.includes("process.argv"), true, "code between two apostrophes must survive");
});

/* ------------------------------------------------- THE BOUNDARY, asserted */

const JSONC = [
  "{",
  "  // the example config carries comments, which is the point of jsonc",
  '  "name": "dustinedwards",',
  '  "docs": "https://developers.cloudflare.com/workers/",',
  '  "share": "//cdn.example.com/dustin-edwards-logo.svg",',
  '  "compatibility_date": "2026-01-01"',
  "}",
].join("\n");

test("THE JSONC BOUNDARY MOVED, and it moved because the tokenizer landed", () => {
  /*
   * THIS TEST USED TO ASSERT THE OPPOSITE, and the assertion was correct when
   * it was written. The helper removed comments with a regex, so a
   * PROTOCOL-RELATIVE url inside a string, whose slashes follow a quote rather
   * than a colon, was eaten along with the rest of its line, and the config no
   * longer parsed.
   *
   * The one-pass tokenizer consumes a string literal whole, so the url is
   * inside a literal before any slash is considered. MEASURED 2026-08-28: the
   * fixture below now parses and keeps its url intact.
   *
   * A boundary note is a claim that ages, and this one aged the moment the
   * mechanism under it changed. It is rewritten rather than deleted, because
   * what a reader needs is that the hazard WAS real and what removed it.
   */
  const parsed = JSON.parse(stripComments(JSONC));
  assert.equal(parsed.name, "dustinedwards");
  assert.equal(
    parsed.share,
    "//cdn.example.com/dustin-edwards-logo.svg",
    "the protocol-relative url must survive, which is the whole boundary that moved",
  );
});

const SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">',
  '  <image xlink:href="//cdn.example.com/mark.png" width="48"/>',
  '  <path fill="#0F172A" d="M0 0h48v48H0z"/>',
  "</svg>",
].join("\n");

test("AND THE SVG BOUNDARY WITH IT, for the same reason", () => {
  /*
   * Also an inversion, and the earlier note is worth keeping: the audit said
   * the old form ate the xmlns:xlink attribute. It did NOT, because that is a
   * colon. What it ate was the protocol-relative url and the rest of its line,
   * and that is now inside a string literal the tokenizer consumes whole.
   */
  const out = stripComments(SVG);
  assert.equal(out.includes('xmlns="http://www.w3.org/2000/svg"'), true);
  assert.equal(out.includes("cdn.example.com/mark.png"), true, "the href value survives now");
  assert.equal(out.includes('width="48"/>'), true, "and so does the rest of its line");
});

/* ---------------------------------------- THE DEFECT THIS REWRITE CLOSED */

test("A COMMENT OPENER INSIDE A STRING is not a comment", () => {
  /*
   * REPLAYS THE DEFECT, per the replay rule.
   *
   * Block comments were removed with a regex, which cannot know what a string
   * is. A slash-star inside a string literal opened a comment that ran to the
   * next star-slash ANYWHERE in the file, taking every line between them.
   *
   * MEASURED at HEAD before the fix: 347 string literals across 37 files carry
   * one of those sequences. Most are harmless because a matching closer sits in
   * the same literal, which is exactly what makes the class dangerous: it is
   * silent until two of them line up.
   */
  const src = [
    'const opener = "/*";',
    "const survives = 1;",
    'const closer = "*/";',
    "const alsoSurvives = 2;",
  ].join("\n");

  const out = stripComments(src);
  assert.equal(out.includes("survives"), true, "the code between two literals was swallowed");
  assert.equal(out.includes("alsoSurvives"), true, "and so was the code after them");

  // THE CONTROL. The old body is written out and shown to lose the line
  // between, so the assertion above cannot be satisfied by any implementation.
  const naive = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
  assert.equal(
    naive.includes("survives"),
    false,
    "the regex form no longer swallows the line, so this case does not discriminate",
  );
});

test("A QUOTE INSIDE A REGEX CHARACTER CLASS does not open a string", () => {
  /*
   * The second half, found BY THE DIFFERENTIAL rather than by reading. Once
   * strings were tokenized, a quote inside a regex character class sat outside
   * any literal and paired with the next quote in the file. Six assertion calls
   * in scripts/machine-readable/llms.mjs went invisible to check:invariants section 17.
   */
  const src = [
    "const pattern = /from[\"']x[\"']/;",
    "const survives = 1;",
    "const label = 'the page';",
    "const alsoSurvives = 2;",
  ].join("\n");

  const out = stripCommentsAndStrings(src);
  assert.equal(out.includes("survives"), true, "the code after the regex was swallowed");
  assert.equal(out.includes("alsoSurvives"), true, "and so was the code after the next quote");
});

test("a regex containing a slash in a character class ends where it really ends", () => {
  // A character class may contain the delimiter. A scanner stopping at the
  // first unescaped slash would end the literal in the middle of one.
  const src = 'const p = /[/]/; const after = "kept";';
  const out = stripComments(src);
  assert.equal(out.includes("const after"), true);
  assert.equal(out.includes('"kept"'), true);
});

test("a DIVISION is not read as a regex", () => {
  // The heuristic is on the previous significant character. A division's left
  // operand ends in an identifier or a closing bracket, never in an operator.
  const src = "const ratio = width / height; const after = 1;";
  const out = stripComments(src);
  assert.equal(out.includes("width / height"), true, "the division was eaten as a regex");
  assert.equal(out.includes("const after"), true);
});

/*
 * THE PAIRED-APOSTROPHE SWALLOW. Replays the defect found 2026-08-26.
 *
 * The module's docblock already named this mechanism for apostrophes in PROSE
 * and closed it by stripping comments first. The identical failure through an
 * apostrophe inside a DOUBLE-QUOTED string was open until this landed, because
 * three independent regex passes cannot know that a quote is already inside a
 * literal opened by a different quote character.
 *
 * The apostrophe is built from its char code so no test fixture in this file
 * carries a stray quote that a future reader has to reason about.
 */
const APOSTROPHE = String.fromCharCode(39);

/** Two assertion calls whose labels are both possessive. @param {string} q */
function twoPossessiveCalls(q) {
  return [
    "ok(",
    `  "the page${q}s verdict",`,
    "  someNumber < LIMIT,",
    '  "detail one",',
    ");",
    "ok(",
    `  "the tile${q}s age",`,
    "  otherNumber >= 0,",
    '  "detail two",',
    ");",
  ].join("\n");
}

test("TWO possessive labels do not swallow the code between them", () => {
  const out = stripCommentsAndStrings(twoPossessiveCalls(APOSTROPHE));

  // THE FALSE NEGATIVE, which is the worse direction: the first call used to
  // vanish entirely, so an assertion inside the swallowed span was never
  // examined by the gate whose subject is assertions that cannot fail.
  assert.equal(
    (out.match(/ok\(/g) ?? []).length,
    2,
    "both calls must survive; the first one used to disappear",
  );

  // THE FALSE POSITIVE, which is how it was found: the survivor's condition
  // slot used to read `""""` and was reported as a string literal.
  assert.match(out, /someNumber < LIMIT/, "the first condition must survive");
  assert.match(out, /otherNumber >= 0/, "the second condition must survive");
  assert.doesNotMatch(out, /""""/, "no condition slot may be left holding stacked quotes");
});

test("THE DISCRIMINATING CONTROL: one possessive label was always fine", () => {
  // A single apostrophe never paired, so it never swallowed anything. Without
  // this control the test above could pass against a stripper that simply
  // deleted every apostrophe, which would be a different bug.
  const one = ["ok(", `  "the page${APOSTROPHE}s verdict",`, "  someNumber < LIMIT,", ");"].join("\n");
  const out = stripCommentsAndStrings(one);
  assert.match(out, /someNumber < LIMIT/);
  assert.equal((out.match(/ok\(/g) ?? []).length, 1);
});

test("a genuine single-quoted string is still blanked", () => {
  // The fix must not have turned single quotes into ordinary characters.
  const src = `const a = ${APOSTROPHE}secret${APOSTROPHE}; const b = keep;`;
  const out = stripCommentsAndStrings(src);
  assert.doesNotMatch(out, /secret/, "a single-quoted literal must still be blanked");
  assert.match(out, /const b = keep;/);
});

test("a blanked multi-line template keeps the lines it spanned", () => {
  // Section 17 reports a file and a LINE and computes it from the blanked text.
  // A template collapsing to two characters moved every line after it, which is
  // why the failure that found this pointed at a line holding something else.
  const src = ["a(", "  `one", "two", "three`,", "  x > 1,", ");"].join("\n");
  const out = stripCommentsAndStrings(src);
  assert.equal(
    (out.match(/\n/g) ?? []).length,
    (src.match(/\n/g) ?? []).length,
    "the line count must be preserved across a blanked template",
  );
  assert.match(out, /x > 1/);
});

test("an unterminated literal keeps the rest of the file rather than eating it", () => {
  const src = `const a = "never closed;\nconst b = keep;`;
  const out = stripCommentsAndStrings(src);
  assert.match(out, /const b = keep;/, "the remainder must survive an unterminated literal");
});
