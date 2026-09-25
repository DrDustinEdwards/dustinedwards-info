/* The note must stay in the prose flow as a sibling of its paragraph and the stylesheet floats
 * it into the rail; hoisting it elsewhere would need script to measure its alignment. */

import test from "node:test";
import assert from "node:assert/strict";

import { render } from "./lib/render.mjs";

test("it renders an aside with the kind label first", async () => {
  const { html } = await render(':::sidenote{kind="Fallback"}\nA short note.\n:::\n');
  assert.match(html, /<aside class="post-note" id="sn-1"><b class="post-note-kind">Fallback<\/b>/);
  assert.match(html, /<p>A short note\.<\/p><\/aside>/);
});

/* Ids added later would mean migrating every published note, so the numbering is asserted. */
test("notes are numbered per document, in source order", async () => {
  const { html } = await render(
    ':::sidenote{kind="One"}\nA.\n:::\n\nBetween.\n\n:::sidenote{kind="Two"}\nB.\n:::\n',
  );
  assert.match(html, /id="sn-1"/);
  assert.match(html, /id="sn-2"/);
  assert.ok(
    html.indexOf('id="sn-1"') < html.indexOf('id="sn-2"'),
    "numbering follows source order",
  );
});

test("an `aside`, so a screen reader can skip what is tangential", async () => {
  const { html } = await render(':::sidenote{kind="Aside"}\nText.\n:::\n');
  assert.match(html, /^<aside /);
  assert.doesNotMatch(html, /<div class="post-note"/);
});

test("the note stays between the paragraph it follows and the one after it", async () => {
  const { html } = await render(
    "First paragraph.\n\n:::sidenote{kind=\"Caveat\"}\nThe note.\n:::\n\nSecond paragraph.\n",
  );
  const first = html.indexOf("First paragraph");
  const note = html.indexOf("post-note");
  const second = html.indexOf("Second paragraph");
  assert.ok(first >= 0 && note >= 0 && second >= 0, html);
  assert.ok(first < note, "the note was hoisted above the paragraph it annotates");
  assert.ok(note < second, "the note was pushed past the paragraph it annotates");
});

test("a note without a kind is a named build error, not an unlabelled box", async () => {
  await assert.rejects(
    () => render(":::sidenote\nNo label.\n:::\n"),
    /requires a kind attribute/,
  );
});

test("a heading inside a note is refused: the rail is not where a section goes", async () => {
  await assert.rejects(
    () => render(':::sidenote{kind="Aside"}\n## A section\n:::\n'),
    /holds a heading/,
  );
});

test("two notes on one page each keep their own label", async () => {
  const { html } = await render(
    ':::sidenote{kind="One"}\nA.\n:::\n\nBetween.\n\n:::sidenote{kind="Two"}\nB.\n:::\n',
  );
  assert.match(html, /post-note-kind">One</);
  assert.match(html, /post-note-kind">Two</);
});
