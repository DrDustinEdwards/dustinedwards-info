import test from "node:test";
import assert from "node:assert/strict";

import { stripComments, stripCommentsAndStrings } from "../scripts/lib/strip-comments.mjs";

test("block and line comments go", () => {
  assert.equal(stripComments("const a = 1; // note").trim(), "const a = 1;");
  assert.equal(stripComments("const /* mid */ a = 1;").includes("mid"), false);
});

test("THE COLON GUARD: a url in a string is not a comment", () => {
  const src = 'const docs = "https://developers.cloudflare.com/workers/";';
  assert.equal(stripComments(src).includes("developers.cloudflare.com"), true);
});

test("a comment naming a forbidden literal cannot satisfy a scan", () => {
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
  const src = ["/* the editor's own copy */", "const real = process.argv;", "// doesn't matter"].join("\n");
  const out = stripCommentsAndStrings(src);
  assert.equal(out.includes("process.argv"), true, "code between two apostrophes must survive");
});

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
  const out = stripComments(SVG);
  assert.equal(out.includes('xmlns="http://www.w3.org/2000/svg"'), true);
  assert.equal(out.includes("cdn.example.com/mark.png"), true, "the href value survives now");
  assert.equal(out.includes('width="48"/>'), true, "and so does the rest of its line");
});

test("A COMMENT OPENER INSIDE A STRING is not a comment", () => {
  const src = [
    'const opener = "/*";',
    "const survives = 1;",
    'const closer = "*/";',
    "const alsoSurvives = 2;",
  ].join("\n");

  const out = stripComments(src);
  assert.equal(out.includes("survives"), true, "the code between two literals was swallowed");
  assert.equal(out.includes("alsoSurvives"), true, "and so was the code after them");

  // Control: the naive regex form loses the line, or this case does not discriminate.
  const naive = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
  assert.equal(
    naive.includes("survives"),
    false,
    "the regex form no longer swallows the line, so this case does not discriminate",
  );
});

test("A QUOTE INSIDE A REGEX CHARACTER CLASS does not open a string", () => {
  /*
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
  const src = 'const p = /[/]/; const after = "kept";';
  const out = stripComments(src);
  assert.equal(out.includes("const after"), true);
  assert.equal(out.includes('"kept"'), true);
});

test("a DIVISION is not read as a regex", () => {
  const src = "const ratio = width / height; const after = 1;";
  const out = stripComments(src);
  assert.equal(out.includes("width / height"), true, "the division was eaten as a regex");
  assert.equal(out.includes("const after"), true);
});

// Built from its char code so no fixture in this file carries a stray quote.
const APOSTROPHE = String.fromCharCode(39);

/** @param {string} q */
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

  assert.equal(
    (out.match(/ok\(/g) ?? []).length,
    2,
    "both calls must survive; the first one used to disappear",
  );

  assert.match(out, /someNumber < LIMIT/, "the first condition must survive");
  assert.match(out, /otherNumber >= 0/, "the second condition must survive");
  assert.doesNotMatch(out, /""""/, "no condition slot may be left holding stacked quotes");
});

test("THE DISCRIMINATING CONTROL: one possessive label was always fine", () => {
  // Without this control the test above could pass against a stripper that simply
  // deleted every apostrophe.
  const one = ["ok(", `  "the page${APOSTROPHE}s verdict",`, "  someNumber < LIMIT,", ");"].join("\n");
  const out = stripCommentsAndStrings(one);
  assert.match(out, /someNumber < LIMIT/);
  assert.equal((out.match(/ok\(/g) ?? []).length, 1);
});

test("a genuine single-quoted string is still blanked", () => {
  const src = `const a = ${APOSTROPHE}secret${APOSTROPHE}; const b = keep;`;
  const out = stripCommentsAndStrings(src);
  assert.doesNotMatch(out, /secret/, "a single-quoted literal must still be blanked");
  assert.match(out, /const b = keep;/);
});

test("a blanked multi-line template keeps the lines it spanned", () => {
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

test("an apostrophe in JSX text does not shield the comments after it", () => {
  const src = [
    `const p = <p>Don${APOSTROPHE}t do this</p>;`,
    "// confirmationSatisfied() is only named here",
    "const b = keep;",
  ].join("\n");
  const out = stripComments(src);
  assert.doesNotMatch(out, /confirmationSatisfied/, "the comment after the apostrophe must go");
  assert.match(out, /const b = keep;/);
});

test("an unclosed block-comment opener is text, not the rest of the file", () => {
  const src = "const glob = <code>src/*.ts</code>;\nconst b = keep; // gone";
  const out = stripComments(src);
  assert.match(out, /const b = keep;/);
  assert.doesNotMatch(out, /gone/);
});
