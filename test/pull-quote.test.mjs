/* A pull quote authored as its own block would put the sentence in the source twice, and the
 * markdown twin serves the source verbatim, so the sentence is marked where it already lives. */

import test from "node:test";
import assert from "node:assert/strict";

import { renderBody } from "../app/lib/content/pipeline.mjs";

/** @param {string} body */
const render = (body) => renderBody({ file: "test.md", body, resolveImage: () => null });

const SENTENCE = "the measurement is the argument";
const PARAGRAPH = `The method matters, but :pullquote[${SENTENCE}] and nothing else settles it.`;

test("the quote is raised ABOVE the paragraph it was marked in", async () => {
  const { html } = await render(`Intro.\n\n${PARAGRAPH}\n`);
  const quote = html.indexOf('class="pull-quote"');
  const prose = html.indexOf("The method matters");
  assert.ok(quote > -1 && prose > -1);
  assert.ok(quote < prose, "a pull quote after its sentence is a repetition, not an invitation");
});

test("it is hidden from assistive technology, as the literal string", async () => {
  const { html } = await render(PARAGRAPH);
  /* A boolean stringifies to "true" here anyway, so this asserts what reaches the page. */
  assert.match(html, /<p class="pull-quote" aria-hidden="true">/);
});

test("the paragraph renders exactly as it would have without the marker", async () => {
  const marked = await render(PARAGRAPH);
  const plain = await render(PARAGRAPH.replace(`:pullquote[${SENTENCE}]`, SENTENCE));
  /* Strip the raised copy and the rest must be byte-identical to the unmarked render, or the
   * marker is editing the post. */
  const stripped = marked.html.replace(/<p class="pull-quote"[^>]*>[^<]*<\/p>\n?/, "");
  assert.equal(stripped, plain.html);
});

test("it is not a blockquote", async () => {
  /* A blockquote is a quotation from somewhere else. This is the page quoting itself. */
  const { html } = await render(PARAGRAPH);
  assert.ok(!html.includes("<blockquote"));
});

test("two are allowed and a third is refused", async () => {
  const two = "a :pullquote[one] x\n\nb :pullquote[two] y\n";
  await render(two);
  await assert.rejects(render(`${two}\nc :pullquote[three] z\n`), /pull quote number 3/);
});

test("two in one paragraph are refused", async () => {
  await assert.rejects(render("a :pullquote[one] and :pullquote[two] b\n"), /carries 2 pull quotes/);
});

test("an over-long quote is refused and an at-the-limit one is not", async () => {
  const limit = "w".repeat(160);
  await render(`x :pullquote[${limit}] y\n`);
  await assert.rejects(render(`x :pullquote[${limit}w] y\n`), /is 161 characters/);
});

test("an empty marker and a nested one are both refused", async () => {
  await assert.rejects(render("x :pullquote[] y\n"), /is empty/);
  await assert.rejects(render("x *a :pullquote[b] c* y\n"), /nested inside other markup/);
});
