/**
 * The shared JS-scan comment stripper, and the boundary it must not cross.
 *
 * Nine gates carried their own copy of one job. The risk consolidation removes
 * is DRIFT IN STRENGTH: a copy weaker than its siblings does not fail, it
 * passes for a reason nobody checks. check:logo's copy was exactly that, and
 * the plant in check:logo proves it.
 *
 * THE BOUNDARY IS ASSERTED HERE RATHER THAN DESCRIBED. The reconciliation ruled
 * this helper must never be fed JSONC or SVG. A comment saying so is a claim
 * that ages, per hard rule 7; the tests below FEED it those and assert the
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

const WEAK = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const JSONC = [
  "{",
  "  // the example config carries comments, which is the point of jsonc",
  '  "name": "dustinedwards",',
  '  "docs": "https://developers.cloudflare.com/workers/",',
  '  "share": "//cdn.example.com/logo.svg",',
  '  "compatibility_date": "2026-01-01"',
  "}",
].join("\n");

test("THIS HELPER MUST NEVER BE FED JSONC, and here is what happens if it is", () => {
  // The colon guard protects "https://". It cannot protect a PROTOCOL-RELATIVE
  // url, whose slashes follow a quote rather than a colon.
  assert.throws(
    () => JSON.parse(stripComments(JSONC)),
    "the strong form must break this config, which is why the JSONC readers keep the weak one",
  );
});

test("the weak form is SUFFICIENT for JSONC, which is why it stays", () => {
  const parsed = JSON.parse(WEAK(JSONC));
  assert.equal(parsed.name, "dustinedwards");
  assert.equal(parsed.share, "//cdn.example.com/logo.svg", "the url must survive intact");
  // And the reason weak is enough: a surviving comment does not pass silently.
  assert.throws(() => JSON.parse(JSONC), "JSON.parse throws on a comment it was not given");
});

const SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">',
  '  <image xlink:href="//cdn.example.com/mark.png" width="48"/>',
  '  <path fill="#0F172A" d="M0 0h48v48H0z"/>',
  "</svg>",
].join("\n");

test("NOR SVG: the audit named the wrong mechanism, and this is the real one", () => {
  // The audit said the strong form eats xmlns:xlink="http://...". Measured, it
  // does NOT: that is a colon. What it eats is the protocol-relative url, and
  // it takes the rest of the line with it.
  const out = stripComments(SVG);
  assert.equal(out.includes('xmlns="http://www.w3.org/2000/svg"'), true, "the colon case IS safe");
  assert.equal(out.includes("cdn.example.com/mark.png"), false, "the href value is destroyed");
  assert.equal(out.includes('width="48"/>'), false, "and so is the rest of its line");

  assert.equal(WEAK(SVG).includes("cdn.example.com/mark.png"), true, "the weak form keeps it");
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
