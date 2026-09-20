/**
 * The `:::sidenote` directive: a short note that renders beside the paragraph it follows.
 *
 * WHAT MAKES THIS WORTH A TEST rather than a reading: the alignment is the whole feature and it is
 * a property of WHERE THE NOTE SITS IN THE DOCUMENT. A note lifted into the rail container would
 * need its paragraph's position measured to line up, which is script on a plane that does not
 * hydrate. So the directive must leave the note in the prose flow, as a sibling of the paragraph
 * it annotates, and the stylesheet floats it into the rail. If that ever changes to "collect the
 * notes and emit them elsewhere", the alignment silently becomes a lie and nothing else would say
 * so.
 *
 * The kind refusal is the other enforceable half: the label is a reader's only cue about what the
 * note is before they decide to read it.
 *
 * @see app/lib/content/pipeline.mjs
 * @see app/styles/post-rail.css
 */

import test from "node:test";
import assert from "node:assert/strict";

import { KNOWN_DIRECTIVES, renderBody } from "../app/lib/content/pipeline.mjs";

/** @param {string} body */
const render = (body) => renderBody({ file: "test.md", body, resolveImage: () => null });

test("the directive is registered, or every use of it is an unknown-directive failure", () => {
  assert.ok(KNOWN_DIRECTIVES.includes("sidenote"));
});

test("it renders an aside with the kind label first", async () => {
  const { html } = await render(':::sidenote{kind="Fallback"}\nA short note.\n:::\n');
  assert.match(html, /<aside class="post-note"><b class="post-note-kind">Fallback<\/b>/);
  assert.match(html, /<p>A short note\.<\/p><\/aside>/);
});

test("an `aside`, so a screen reader can skip what is tangential", async () => {
  const { html } = await render(':::sidenote{kind="Aside"}\nText.\n:::\n');
  assert.match(html, /^<aside /);
  assert.doesNotMatch(html, /<div class="post-note"/);
});

/*
 * THE ALIGNMENT CONTRACT. The note must stay where the author put it: immediately after its
 * paragraph and before the next one. Anything that hoists notes to the top or the end of the body
 * breaks the float's whole basis.
 */
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
