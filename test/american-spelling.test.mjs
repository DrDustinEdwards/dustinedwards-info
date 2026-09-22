/**
 * The rules that keep American spelling off identifiers. Each case is a shape found in this repo
 * when the rewrite was first run (2026-09-22). This file is outside the gate's scope, since it
 * has to hold British forms to test them.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { americanFor, americanize } from "../scripts/lib/american-spelling.mjs";

test("whole words from the list, case following the token", () => {
  assert.equal(americanFor("colour"), "color");
  assert.equal(americanFor("Behaviour"), "Behavior");
  assert.equal(americanFor("normalised"), "normalized");
  assert.equal(americanFor("COLOUR"), null, "all caps is a constant, not prose");
  assert.equal(americanFor("organism"), null, "a stem list would have caught organism");
  assert.equal(americanFor("analyses"), null, "plural of analysis, and ambiguous");
});

test("comments and spaced strings change; code and spaceless literals do not", () => {
  const src = [
    "// the colour of the rule",
    'const kind = "turbid-centre";',
    'const label = "Turbid centre";',
    "const normalised = serialiseTags(colour);",
  ].join("\n");
  const { text, left } = americanize(src, "code");
  assert.match(text, /the color of the rule/);
  assert.match(text, /"turbid-centre"/, "a literal with no whitespace is an identifier");
  assert.match(text, /"Turbid center"/);
  assert.match(text, /const normalised = serialiseTags\(colour\);/, "code is never rewritten");
  assert.deepEqual(left.map((l) => l.british).sort(), ["centre", "colour", "normalised"]);
});

test("a regex literal holding a quote does not open a string", () => {
  const src = 'const q = /["\']/;\n// a grey comment\n';
  assert.match(americanize(src, "code").text, /a gray comment/);
});

test("template text changes and the ${} expression does not", () => {
  const src = "const m = `the ${colour} has no colour`;";
  assert.equal(americanize(src, "code").text, "const m = `the ${colour} has no color`;");
});

test("JSX text is copy, in .tsx only", () => {
  const src = "const x = <p>\n  licence\n</p>;";
  assert.match(americanize(src, "code", { jsx: true }).text, /license/);
  assert.match(americanize(src, "code").text, /licence/);
});

test("prose keeps identifier-shaped backtick spans", () => {
  const { text } = americanize("The `colour` key sets the colour, and `a colour` is prose.", "prose");
  assert.equal(text, "The `colour` key sets the color, and `a color` is prose.");
});
